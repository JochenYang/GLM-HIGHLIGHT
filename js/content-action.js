// 启动初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initialize());
} else {
  initialize();
}

// 使用highlighter的实例
const highlighter = window.highlighter;

// 优化的节点处理
function processNodes(nodes, options = {}) {
  if (!nodes.size) return;
  
  let isProcessing = false;
  
  return Utils.async.retry(
    async (signal) => {
      if (isProcessing) return;
      isProcessing = true;
      
      try {
        const startTime = Date.now();
        let processed = 0;

        const processBatch = () => {
          if (signal?.aborted || 
              Date.now() - startTime > window.highlighter.config.performance.timeout) {
            return;
          }

          const batchSize = window.highlighter.config.performance.calculateBatchSize();
          const end = Math.min(processed + batchSize, nodes.size);
          
          const processNode = (node) => {
            if (node instanceof Node && document.contains(node)) {
              try {
                // 确保完全清理旧的高亮
                window.highlighter.clearHighlight(node);
                
                // 检查节点是否仍在文档中
                if (document.contains(node) && 
                    window.tabActive && 
                    window.keywords?.length) {
                  window.highlighter.highlight(node, window.keywords);
                }
              } catch (error) {
                console.warn('处理节点失败:', error);
              }
            }
          };

          for (const node of Array.from(nodes).slice(processed, end)) {
            processNode(node);
            processed++;
          }

          if (processed < nodes.size) {
            requestAnimationFrame(processBatch);
          }
        };

        if (window.requestIdleCallback) {
          requestIdleCallback(processBatch, {
            timeout: window.highlighter.config.performance.idleTimeout
          });
        } else {
          requestAnimationFrame(processBatch);
        }
        
        return processed;
      } finally {
        isProcessing = false;
      }
    },
    options
  );
}

const throttledProcess = Utils.performance.throttle(processNodes, 100);

// 统一的DOM观察器
function setupUnifiedObserver() {
  let lastUrl = location.href;
  
  const observer = new MutationObserver((mutations) => {
    try {
      // 1. 检查URL变化
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        if (window.tabActive && window.keywords?.length) {
          requestAnimationFrame(() => {
            window.highlighter.highlight(document.body, window.keywords);
          });
        }
        return;
      }

      // 2. 收集需要处理的节点
      const changedNodes = new Set();
      
      mutations.forEach(mutation => {
        // 处理节点添加
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              changedNodes.add(node);
            }
          });
        }

        // 旧版本的文本处理更简洁
        if (mutation.type === 'characterData' && mutation.target) {
          const parentElement = mutation.target.parentElement;
          if (parentElement && !parentElement.classList?.contains(window.highlighter.config.className)) {
            changedNodes.add(parentElement);
          }
        }
      });

      // 3. 使用改进的批处理
      if (changedNodes.size > 0) {
        processNodes(changedNodes);
      }
    } catch (error) {
      console.error('DOM观察器错误:', error);
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
    characterDataOldValue: true
  });

  return observer;
}

// 初始化函数
async function initialize(retryCount = 0) {
  try {
    // 1. 获取初始状态
    const [isActive, keywords] = await Promise.all([
      chrome.runtime.sendMessage({
        opt: "rpc",
        func: "getActiveStatus"
      }),
      chrome.runtime.sendMessage({
        opt: "rpc",
        func: "getKeywords"
      })
    ]);

    // 2. 设置全局状态
    window.tabActive = isActive;
    window.keywords = keywords || [];

    // 3. 立即执行初始高亮，不等待 requestAnimationFrame
    if (window.tabActive && window.keywords?.length) {
      window.highlighter.highlight(document.body, window.keywords);
    }

    // 4. 设置观察器
    setupUnifiedObserver();

  } catch (error) {
    Utils.handleError(error, 'initialize', 'RUNTIME');
    if (retryCount < 3) {
      setTimeout(() => initialize(retryCount + 1), 100); // 减少重试延迟
    }
  }
}

// 统一的高亮处理
function handleHighlight(element, keywords, shouldClear = true) {
  if (!window.highlighter || !element) return;

  try {
    if (shouldClear) {
      window.highlighter.clearHighlight(element);
    }
    
    if (keywords?.length) {
      window.highlighter.highlight(element, keywords);
    }
  } catch (error) {
    Utils.handleError(error, 'handleHighlight', 'DOM');
  }
}

// 处理删除高亮
async function handleRemoveHighlight() {
  try {
    const selection = window.getSelection();
    const text = selection.toString().trim();
    
    if (!text) return;

    // 获取当前所有分类
    const response = await chrome.runtime.sendMessage({
      opt: "rpc",
      func: "getKeywordsString2"
    });
    
    const categories = response || [];
    let removed = false;

    // 从所有分类中删除选中的文本
    categories.forEach(category => {
      if (category.data) {
        const words = category.data.trim().split(/\s+/);
        const index = words.indexOf(text);
        if (index !== -1) {
          words.splice(index, 1);
          category.data = words.join(' ');
          removed = true;
        }
      }
    });

    if (removed) {
      // 保存更新
      await chrome.runtime.sendMessage({
        opt: "rpc",
        func: "setKeywordsString2",
        args: [categories]
      });

      // 通知刷新高亮
      await chrome.runtime.sendMessage({
        opt: "event",
        event: "reapplyHighlights"
      });
    }
  } catch (error) {
    console.error('删除高亮失败:', error);
  }
}

// 消息处理
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'add-to-category') {
    handleSelection();
  } else if (message.type === 'remove-highlight') {
    handleRemoveHighlight();
  } else if (message.opt === "event") {
    switch(message.event) {
      case "storageChange":
        if (message.args.key === "isActive") {
          window.tabActive = message.args.value;
          if (window.tabActive && window.keywords?.length) {
            handleHighlight(document.body, window.keywords);
          } else {
            handleHighlight(document.body, null, true);
          }
        }
        else if (message.args.key === "fwm_keywordsArray") {
          window.keywords = message.args.value || [];
          if (window.tabActive) {
            handleHighlight(document.body, window.keywords);
          }
        }
        break;
        
      case "clearHighlights":
        handleHighlight(document.body, null, true);
        break;
        
      case "reapplyHighlights":
        if (window.tabActive && window.keywords?.length) {
          handleHighlight(document.body, window.keywords);
        }
        break;
    }
  }
});

// 检查节点是否已经高亮
function isHighlightedText(node) {
  if (!node) return false;
  
  // 检查当前节点
  if (node.nodeType === Node.ELEMENT_NODE && 
      node.classList?.contains(window.highlighter.config.className)) {
    return true;
  }
  
  // 检查父节点
  let parent = node.parentElement;
  while (parent) {
    if (parent.classList?.contains(window.highlighter.config.className)) {
      return true;
    }
    parent = parent.parentElement;
  }
  
  return false;
}

// 添加选择文本处理
let dialogElement = null;

async function handleSelection(e) {
    try {
        const text = window.getSelection().toString().trim();
        if (!text) return;
        
        // 获取选区位置
        const selection = window.getSelection();
        const range = selection.getRangeAt(selection.rangeCount - 1);
        const rect = range.getBoundingClientRect();
        
        // 计算弹窗位置
        const position = {
            x: Math.min(rect.left, window.innerWidth - 320),
            y: Math.min(rect.bottom + window.scrollY, window.innerHeight - 420)
        };

        // 获取分类列表
        const categories = await chrome.runtime.sendMessage({
            opt: "rpc",
            func: "getKeywordsString2"
        });

        // 如果已存在弹窗则移除
        if (dialogElement) {
            dialogElement.remove();
        }

        // 创建弹窗
        dialogElement = document.createElement('div');
        dialogElement.className = 'highlight-dialog';
        dialogElement.style.cssText = `
            position: fixed;
            left: ${position.x}px;
            top: ${position.y}px;
            z-index: 2147483647;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 12px rgba(0,0,0,0.1);
            padding: 12px;
            max-width: 300px;
            width: 100%;
            max-height: 400px;
            overflow-y: auto;
        `;

        // 添加标题
        const title = document.createElement('div');
        title.style.cssText = `
            font-size: 14px;
            color: #606266;
            margin-bottom: 12px;
            padding-bottom: 8px;
            border-bottom: 1px solid #ebeef5;
        `;
        title.textContent = '选择分类';
        dialogElement.appendChild(title);

        // 添加分类列表
        categories.forEach(category => {
            const item = document.createElement('div');
            item.style.cssText = `
                display: flex;
                align-items: center;
                padding: 8px;
                cursor: pointer;
                border-radius: 4px;
                margin-bottom: 4px;
                transition: background-color 0.2s;
            `;
            item.innerHTML = `
                <div class="chrome-extension-mutihighlight-style-${category.colour}" 
                     style="width:16px;height:16px;margin-right:8px;border-radius:2px;">
                </div>
                <span style="flex:1;color:#606266;">${category.name || '未命名分类'}</span>
            `;

            // 悬停效果
            item.onmouseover = () => item.style.backgroundColor = '#f5f7fa';
            item.onmouseout = () => item.style.backgroundColor = 'transparent';

            // 点击处理
            item.onclick = async () => {
                try {
                    const words = new Set((category.data || '').trim().split(/\s+/));
                    words.add(text);
                    category.data = Array.from(words).join(' ');

                    // 更新数据
                    await chrome.runtime.sendMessage({
                        opt: "rpc",
                        func: "setKeywordsString2",
                        args: [categories]
                    });

                    // 刷新高亮
                    chrome.runtime.sendMessage({
                        opt: "event",
                        event: "reapplyHighlights"
                    });

                    // 关闭弹窗
                    dialogElement.remove();
                    dialogElement = null;
                } catch (error) {
                    console.error('添加高亮失败:', error);
                }
            };

            dialogElement.appendChild(item);
        });

        // 添加到页面
        document.body.appendChild(dialogElement);

        // 点击其他区域关闭弹窗
        const closeHandler = (e) => {
            if (!dialogElement?.contains(e.target)) {
                dialogElement?.remove();
                dialogElement = null;
                document.removeEventListener('mousedown', closeHandler);
            }
        };
        document.addEventListener('mousedown', closeHandler);

    } catch (error) {
        console.error('处理选择文本失败:', error);
    }
}

// 只处理快捷键和右键菜单消息
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'add-to-category') {
    handleSelection();
  }
});

