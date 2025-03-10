class CategoryDialog {
  constructor() {
    this.dialog = document.querySelector('.category-dialog');
    this.list = document.querySelector('.category-list');
    this.selectedText = document.querySelector('.selected-text');
    this.closeBtn = document.querySelector('.close-btn');
    
    this.selectedIndex = 0;
    this.categories = [];
    
    this.initEvents();
  }
  
  initEvents() {
    // 监听来自父窗口的消息
    window.addEventListener('message', async (event) => {
      if (event.data.type === 'show-dialog') {
        await this.show(event.data.text);
      }
    });

    // 键盘导航
    document.addEventListener('keydown', e => {
      switch(e.key) {
        case 'ArrowUp':
          e.preventDefault();
          this.selectPrev();
          break;
        case 'ArrowDown':
          e.preventDefault(); 
          this.selectNext();
          break;
        case 'Enter':
          this.confirm();
          break;
        case 'Escape':
          this.close();
          break;
      }
    });
    
    // 点击选择
    this.list.addEventListener('click', e => {
      const item = e.target.closest('.category-item');
      if (item) {
        const index = Array.from(this.list.children).indexOf(item);
        this.selectedIndex = index;
        this.updateSelection();
        this.confirm();
      }
    });

    // 点击外部关闭
    document.addEventListener('click', e => {
      if (!this.dialog.contains(e.target)) {
        this.close();
      }
    });

    // 添加关闭按钮点击事件
    this.closeBtn.addEventListener('click', () => {
      this.close();
    });
  }
  
  async show(text) {
    try {
      this.selectedText.textContent = text;
      
      // 获取分类列表
      const response = await chrome.runtime.sendMessage({
        opt: "rpc",
        func: "getKeywordsString2" 
      });
      
      this.categories = response || [];
      
      // 渲染分类列表，使用国际化支持
      this.list.innerHTML = this.categories.map((cat, i) => {
        const categoryName = cat.name || chrome.i18n.getMessage('untitledCategory', `${i + 1}`);
        return `
          <div class="category-item ${i === 0 ? 'active' : ''}" data-category-index="${i}">
            ${categoryName}
          </div>
        `;
      }).join('');
      
      // 更新对话框标题
      const dialogTitle = document.querySelector('[data-i18n="selectCategory"]');
      if (dialogTitle) {
        dialogTitle.textContent = chrome.i18n.getMessage('selectCategory', '选择分类');
      }
      
      this.dialog.style.display = 'block';
      this.selectedIndex = 0;
      this.updateSelection();
    } catch (error) {
      Utils.handleError(error, 'show', 'DOM');
    }
  }
  
  close() {
    try {
      // 先隐藏对话框
      if (this.dialog) {
        this.dialog.style.display = 'none';
      }
      
      // 通知父页面关闭iframe
      if (window.parent) {
        window.parent.postMessage({
          type: 'close-dialog'
        }, '*');
      }
    } catch (error) {
      console.error('关闭对话框失败:', error);
    }
  }
  
  selectPrev() {
    if (this.selectedIndex > 0) {
      this.selectedIndex--;
      this.updateSelection();
    }
  }
  
  selectNext() {
    if (this.selectedIndex < this.categories.length - 1) {
      this.selectedIndex++;
      this.updateSelection(); 
    }
  }
  
  updateSelection() {
    const items = this.list.querySelectorAll('.category-item');
    items.forEach((item, i) => {
      item.classList.toggle('active', i === this.selectedIndex);
    });
  }
  
  async confirm() {
    try {
      const category = this.categories[this.selectedIndex];
      if (!category) return;
      
      const text = this.selectedText.textContent;
      
      // 添加到分类
      category.data = category.data ? `${category.data} ${text}` : text;
      
      // 保存更新
      await chrome.runtime.sendMessage({
        opt: "rpc", 
        func: "setKeywordsString2",
        args: [this.categories]
      });

      // 通知内容页面刷新高亮
      await chrome.runtime.sendMessage({
        opt: "event",
        event: "reapplyHighlights"
      });

      // 显示成功提示
      if (window.parent) {
        window.parent.postMessage({
          type: 'show-toast',
          message: chrome.i18n.getMessage('addHighlightSuccess', '添加高亮成功')
        }, '*');
      }
      
      this.close();
    } catch (error) {
      console.error('添加关键词失败:', error);
      // 显示错误提示
      if (window.parent) {
        window.parent.postMessage({
          type: 'show-toast',
          message: chrome.i18n.getMessage('addHighlightError', '添加失败，请重试'),
          type: 'error'
        }, '*');
      }
    }
  }
}

window.categoryDialog = new CategoryDialog(); 