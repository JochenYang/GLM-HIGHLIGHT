// 通用工具函数
window.Utils = {
  // 错误类型定义
  ErrorTypes: {
    VALIDATION: "validation_error",
    RUNTIME: "runtime_error",
    NETWORK: "network_error",
    STORAGE: "storage_error",
    DOM: "dom_error",
  },

  // 统一的错误处理
  handleError(error, context = "", type = "RUNTIME") {
    console.error(`[${type}] ${context}:`, error);
    // 可以添加错误上报等功能
  },

  // 简化防抖函数
  debounce(func, wait) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  },

  // 简化节流函数
  throttle(func, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  },

  // 消息验证
  verifyMessage(message, type = "rpc") {
    if (!message || typeof message !== "object") {
      return this.handleError(
        new Error("Invalid message format"),
        "verifyMessage",
        "VALIDATION"
      );
    }

    // 处理添加到分类的消息
    if (message.type === "add-to-category") {
      return { success: true };
    }

    // 处理其他类型消息
    switch (type) {
      case "rpc":
        if (!message.opt || !message.func) {
          return this.handleError(
            new Error("Invalid RPC message"),
            "verifyMessage",
            "VALIDATION"
          );
        }
        break;
      case "event":
        if (!message.opt || !message.event) {
          return this.handleError(
            new Error("Invalid event message"),
            "verifyMessage",
            "VALIDATION"
          );
        }
        break;
    }

    return { success: true };
  },

  // 安全的DOM操作
  safeDOM: {
    getElement(selector, context = document) {
      try {
        return context.querySelector(selector);
      } catch (error) {
        return Utils.handleError(error, "getElement", "DOM").error;
      }
    },

    addEvent(element, event, handler, options = {}) {
      try {
        if (element && typeof handler === "function") {
          element.addEventListener(event, handler, options);
          return true;
        }
        return false;
      } catch (error) {
        return Utils.handleError(error, "addEvent", "DOM").error;
      }
    },

    removeEvent(element, event, handler, options = {}) {
      try {
        if (element && typeof handler === "function") {
          element.removeEventListener(event, handler, options);
          return true;
        }
        return false;
      } catch (error) {
        return Utils.handleError(error, "removeEvent", "DOM").error;
      }
    },
  },

  // 异步工具
  async: {
    // 简化重试函数
    retry(fn, options = {}) {
      const maxRetries = options.maxRetries || 3;
      const delay = options.delay || 100;
      
      return new Promise((resolve, reject) => {
        const attempt = (retryCount) => {
          Promise.resolve(fn())
            .then(resolve)
            .catch((error) => {
              if (retryCount < maxRetries) {
                setTimeout(() => attempt(retryCount + 1), delay * (retryCount + 1));
              } else {
                reject(error);
              }
            });
        };
        
        attempt(0);
      });
    }
  },

  // 添加 DOM 相关工具方法
  dom: {
    // 只保留核心功能
    isTextNode: (node) => node?.nodeType === Node.TEXT_NODE,
    
    // 简化的节点跳过检查
    shouldSkipNode: (node, config) => {
      if (!node) return true;
      
      // 跳过高亮元素
      if (node.classList?.contains(config.className)) return true;
      
      // 跳过特定标签
      const skipTags = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT'];
      if (skipTags.includes(node.tagName)) return true;
      
      // 检查父节点
      let parent = node.parentElement;
      while (parent) {
        if (parent.classList?.contains(config.className) || 
            skipTags.includes(parent.tagName)) {
          return true;
        }
        parent = parent.parentElement;
      }
      
      return false;
    },
    
    // 安全移除节点
    safeRemove(node) {
      if (node?.parentNode) {
        node.parentNode.removeChild(node);
      }
    }
  },

  // 性能工具 - 简化并修复递归问题
  performance: {
    debounce(fn, wait) {
      return Utils.debounce(fn, wait);
    },
    
    throttle(fn, limit) {
      return Utils.throttle(fn, limit);
    }
  },

  // 添加 LRU 缓存实现
  cache: {
    LRUCache: class {
      constructor(limit = 1000) {
        this.limit = limit;
        this.cache = new Map();
      }

      get(key) {
        if (!this.cache.has(key)) return undefined;

        // 刷新访问
        const value = this.cache.get(key);
        this.cache.delete(key);
        this.cache.set(key, value);
        return value;
      }

      set(key, value) {
        if (this.cache.has(key)) {
          this.cache.delete(key);
        } else if (this.cache.size >= this.limit) {
          // 删除最早的项
          this.cache.delete(this.cache.keys().next().value);
        }
        this.cache.set(key, value);
      }

      clear() {
        this.cache.clear();
      }
    },
  },
};
