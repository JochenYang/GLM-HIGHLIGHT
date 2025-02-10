class KeywordManager {
    constructor() {
        // 核心数据
        this.keywordData = [];
        this.searchText = '';
        
        // 系统词库配置
        this.SYSTEM_CATEGORY_ID = 'system_category';
        
        // DOM 元素
        this.$list = $('#keywordList');
        this.$searchInput = $('#searchInput');
        this.$totalCount = $('#totalCount');
        this.$categoryCount = $('#categoryCount');
        
        // 初始化
        this.initializeEvents();
        this.initialize();
    }

    async initialize() {
        try {
            const response = await chrome.runtime.sendMessage({
                opt: "rpc",
                func: "getKeywordsString2"
            });
            
            this.keywordData = response || [];
            this.render();
            this.updateStats();
            
        } catch (error) {
            console.error('初始化失败:', error);
            this.showNotification('初始化失败，请刷新重试', 'error');
        }
    }

    initializeEvents() {
        // 搜索框直接响应
        this.$searchInput.on('input', Utils.performance.debounce((e) => {
            this.searchText = e.target.value.trim();
            this.render();
        }, 300));

        // 删除按钮点击
        $(document).on('click', '.keyword-delete', async (e) => {
            const $btn = $(e.currentTarget);
            const categoryIndex = $btn.data('category');
            const word = $btn.data('word');
            
            if (await this.showConfirm(`确定要删除关键词"${word}"吗？`)) {
                await this.deleteKeyword(categoryIndex, word);
            }
        });

        // 分类展开/折叠
        $(document).on('click', '.category-header', (e) => {
            const $header = $(e.currentTarget);
            const $content = $header.next('.category-content');
            $content.slideToggle(200);
            $header.toggleClass('collapsed');
        });

        // 分类删除
        $(document).on('click', '.category-delete', async (e) => {
            e.stopPropagation();
            const $btn = $(e.currentTarget);
            const categoryIndex = $btn.data('category');
            const categoryName = this.keywordData[categoryIndex].name || `分类 ${categoryIndex + 1}`;
            
            if (await this.showConfirm(`确定要删除分类"${categoryName}"吗？这将删除该分类下的所有关键词。`)) {
                await this.deleteCategory(categoryIndex);
            }
        });
    }

    async deleteKeyword(categoryIndex, word) {
        try {
            const category = this.keywordData[categoryIndex];
            if (!category) return;

            // 更新数据
            const words = category.data.trim().split(/\s+/).filter(Boolean);
            const newWords = words.filter(w => w !== word);
            category.data = newWords.join(' ');
            
            // 先保存更新到存储
            await chrome.runtime.sendMessage({
                opt: "rpc",
                func: "setKeywordsString2",
                args: [this.keywordData]
            });

            // 获取所有标签页
            const tabs = await chrome.tabs.query({});
            
            // 找到最后激活的非扩展页面标签页
            const extensionUrl = chrome.runtime.getURL('');
            const originalTab = tabs
                .filter(tab => !tab.url.startsWith(extensionUrl))
                .sort((a, b) => b.lastAccessed - a.lastAccessed)[0];

            if (originalTab) {
                // 先清除高亮
                await chrome.tabs.sendMessage(originalTab.id, {
                    opt: "event",
                    event: "clearHighlights"
                }).catch(() => {});

                // 然后重新应用高亮
                const keywords = await chrome.runtime.sendMessage({
                    opt: "rpc",
                    func: "getKeywords"
                });

                await chrome.tabs.sendMessage(originalTab.id, {
                    opt: "event",
                    event: "storageChange",
                    args: {
                        key: "fwm_keywordsArray",
                        value: keywords
                    }
                }).catch(() => {});
            }
            
            // 更新界面
            this.render();
            this.updateStats();
            this.showNotification('关键词删除成功');
            
        } catch (error) {
            Utils.handleError(error, 'deleteKeyword', 'RUNTIME');
            this.showNotification('删除失败，请重试', 'error');
        }
    }

    async deleteCategory(categoryIndex) {
        try {
            const categoryElement = document.querySelector(`[data-category-index="${categoryIndex}"]`);
            if (categoryElement) {
                categoryElement.classList.add('removing-category');
                // 等待动画完成后再删除
                await new Promise(resolve => setTimeout(resolve, 200));
            }

            // 删除分类
            this.keywordData.splice(categoryIndex, 1);
            
            // 保存并通知更新
            await this.saveAndNotify();
            
            // 更新界面
            this.render();
            this.updateStats();
            this.showNotification('分类删除成功');
            
        } catch (error) {
            Utils.handleError(error, 'deleteCategory');
            this.showNotification('删除失败，请重试', 'error');
        }
    }

    async saveAndNotify() {
        try {
            // 保存到存储
            await chrome.runtime.sendMessage({
                opt: "rpc",
                func: "setKeywordsString2",
                args: [this.keywordData]
            });

            // 获取所有标签页
            const tabs = await chrome.tabs.query({});
            
            // 找到最后激活的非扩展页面标签页
            const extensionUrl = chrome.runtime.getURL('');
            const originalTab = tabs
                .filter(tab => !tab.url.startsWith(extensionUrl))
                .sort((a, b) => b.lastAccessed - a.lastAccessed)[0];

            if (originalTab) {
                // 获取新的关键词数组
                const keywords = await chrome.runtime.sendMessage({
                    opt: "rpc",
                    func: "getKeywords"
                });

                // 通知原始标签页更新
                await chrome.tabs.sendMessage(originalTab.id, {
                    opt: "event",
                    event: "storageChange",
                    args: {
                        key: "fwm_keywordsArray",
                        value: keywords
                    }
                }).catch(() => {});
            }
        } catch (error) {
            console.error('保存并通知失败:', error);
        }
    }

    render() {
        const $list = this.$list;
        $list.empty();

        if (!this.keywordData.length) {
            $list.html(this.createEmptyTemplate('暂无关键词'));
            return;
        }

        const categories = this.getFilteredCategories();
        if (!categories.length) {
            $list.html(this.createEmptyTemplate('没有匹配的关键词'));
            return;
        }

        const fragment = document.createDocumentFragment();
        categories.forEach(category => {
            fragment.appendChild(this.createCategoryElement(category));
        });

        $list.append(fragment);
    }

    getFilteredCategories() {
        const searchText = this.searchText;
        
        if (!searchText) {
            return this.keywordData
                .map((category, index) => {
                    if (!category.data) return null;
                    const words = category.data.trim().split(/\s+/).filter(Boolean);
                    if (!words.length) return null;
                    return { ...category, index, filteredWords: words };
                })
                .filter(Boolean);
        }

        return this.keywordData
            .map((category, index) => {
                if (!category.data) return null;

                const words = category.data.trim().split(/\s+/).filter(Boolean);
                const filteredWords = words.filter(word => word.includes(searchText));

                if (!filteredWords.length) return null;

                return {
                    ...category,
                    index,
                    filteredWords
                };
            })
            .filter(Boolean);
    }

    createCategoryElement(category) {
        const div = document.createElement('div');
        div.className = 'keyword-item';
        div.setAttribute('data-category-index', category.index);
        
        // 系统分类特殊处理
        if (category.id === this.SYSTEM_CATEGORY_ID) {
            div.classList.add('system-category');
        }
        
        const headerHtml = `
            <div class="category-header">
                <div class="category-info">
                    <span class="category-name">${category.name || `分类 ${category.index + 1}`}</span>
                    <span class="category-count">${category.filteredWords.length}个关键词</span>
                    ${category.id === this.SYSTEM_CATEGORY_ID ? 
                        `<span class="system-badge">系统词库</span>` : ''}
                </div>
                <div class="category-actions">
                    ${category.id !== this.SYSTEM_CATEGORY_ID ? 
                        `<button class="category-delete" data-category="${category.index}">
                            删除分类
                        </button>` : ''}
                </div>
            </div>
        `;

        const contentHtml = `
            <div class="category-content">
                ${category.filteredWords.map(word => `
                    <div class="keyword-item-row">
                        <span class="keyword-text">${word}</span>
                        <button class="keyword-delete" 
                                data-category="${category.index}" 
                                data-word="${word}">删除</button>
                    </div>
                `).join('')}
            </div>
        `;

        div.innerHTML = headerHtml + contentHtml;
        return div;
    }

    createEmptyTemplate(message) {
        return `
            <div class="empty-state">
                <div class="empty-icon">📝</div>
                <div class="empty-text">${message}</div>
            </div>
        `;
    }

    updateStats() {
        let totalWords = 0;
        let activeCategories = 0;

        this.keywordData.forEach(category => {
            if (category.data) {
                // 使用 Set 来去重，保持大小写敏感
                const words = category.data.trim().split(/\s+/).filter(Boolean);
                const uniqueWords = new Set(words);
                if (uniqueWords.size) {
                    totalWords += uniqueWords.size;
                    activeCategories++;
                }
            }
        });

        this.$totalCount.text(totalWords);
        this.$categoryCount.text(activeCategories);
    }

    showConfirm(message) {
        return new Promise(resolve => {
            const result = confirm(message);
            resolve(result);
        });
    }

    showNotification(message, type = 'success') {
        const notification = $(`
            <div class="notification notification-${type}">
                ${message}
            </div>
        `);
        
        $('body').append(notification);
        
        setTimeout(() => {
            notification.fadeOut(200, function() {
                $(this).remove();
            });
        }, 2000);
    }
}

// 初始化
$(document).ready(() => new KeywordManager()); 