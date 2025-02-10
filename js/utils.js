// 通用工具函数
window.Utils = {
  // 错误类型定义
  ErrorTypes: {
    VALIDATION: 'validation_error',
    RUNTIME: 'runtime_error',
    NETWORK: 'network_error',
    STORAGE: 'storage_error',
    DOM: 'dom_error'
  },

  // 统一的错误处理
  handleError(error, context = '', type = 'RUNTIME') {
    console.error(`[${type}] ${context}:`, error);
    // 可以添加错误上报等功能
  },

  // 优化的防抖函数
  debounce(func, wait, options = {}) {
    let timeout;
    let lastArgs;
    let lastThis;
    let result;
    
    const leading = options.leading === true;
    const trailing = options.trailing !== false;
    
    return function(...args) {
      lastArgs = args;
      lastThis = this;

      if (!timeout && leading) {
        result = func.apply(lastThis, lastArgs);
      }

      clearTimeout(timeout);
      
      timeout = setTimeout(() => {
        if (trailing && lastArgs) {
          result = func.apply(lastThis, lastArgs);
        }
        timeout = null;
        lastArgs = null;
        lastThis = null;
      }, wait);

      return result;
    };
  },

  // 优化的节流函数
  throttle(func, limit, options = {}) {
    let inThrottle;
    let lastResult;
    let lastTime = 0;
    
    const leading = options.leading !== false;
    const trailing = options.trailing !== false;
    
    return function(...args) {
      const now = Date.now();
      
      if (!inThrottle && leading) {
        lastResult = func.apply(this, args);
        lastTime = now;
        inThrottle = true;
      }
      
      if (now - lastTime >= limit) {
        lastResult = func.apply(this, args);
        lastTime = now;
        inThrottle = false;
      } else if (trailing) {
        clearTimeout(inThrottle);
        inThrottle = setTimeout(() => {
          if (Date.now() - lastTime >= limit) {
            lastResult = func.apply(this, args);
            lastTime = Date.now();
          }
        }, limit - (now - lastTime));
      }
      
      return lastResult;
    };
  },

  // 消息验证
  verifyMessage(message, type = 'rpc') {
    if (!message || typeof message !== 'object') {
      return this.handleError(
        new Error('Invalid message format'),
        'verifyMessage',
        'VALIDATION'
      );
    }

    // 处理添加到分类的消息
    if (message.type === 'add-to-category') {
      return { success: true };
    }

    // 处理其他类型消息
    switch(type) {
      case 'rpc':
        if (!message.opt || !message.func) {
          return this.handleError(
            new Error('Invalid RPC message'),
            'verifyMessage',
            'VALIDATION'
          );
        }
        break;
      case 'event':
        if (!message.opt || !message.event) {
          return this.handleError(
            new Error('Invalid event message'),
            'verifyMessage',
            'VALIDATION'
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
        return Utils.handleError(error, 'getElement', 'DOM').error;
      }
    },

    addEvent(element, event, handler, options = {}) {
      try {
        if (element && typeof handler === 'function') {
          element.addEventListener(event, handler, options);
          return true;
        }
        return false;
      } catch (error) {
        return Utils.handleError(error, 'addEvent', 'DOM').error;
      }
    },

    removeEvent(element, event, handler, options = {}) {
      try {
        if (element && typeof handler === 'function') {
          element.removeEventListener(event, handler, options);
          return true;
        }
        return false;
      } catch (error) {
        return Utils.handleError(error, 'removeEvent', 'DOM').error;
      }
    }
  },

  // 异步工具
  async: {
    retry(fn, options = {}) {
      const { retries = 3, delay = 1000 } = options;
      let attempt = 0;
      
      const execute = async () => {
        try {
          return await fn();
        } catch (error) {
          if (++attempt >= retries) throw error;
          await new Promise(resolve => setTimeout(resolve, delay));
          return execute();
        }
      };
      
      return execute();
    }
  },

  // 添加 DOM 相关工具方法
  dom: {
    // 优化节点基础检查，避免频繁的 DOM 树遍历
    isValidNode(node) {
        return node && node.parentNode && 
               // 只在必要时检查 DOM 树
               (node.ownerDocument === document || document.contains(node));
    },

    // 检查是否为文本节点
    isTextNode(node) {
      return node?.nodeType === Node.TEXT_NODE;
    },

    // 统一的节点跳过检查
    shouldSkipNode(node, config) {
      if (!node || !node.parentNode) return true;
      const parent = node.parentElement || node.parentNode;
      return !parent || 
             parent.classList?.contains(config.className) ||
             config.filterRules.shouldSkipTag(parent.tagName) ||
             !config.filterRules.shouldAllowInput(parent) ||
             config.filterRules.isEditable(parent);
    },

    // 添加更多常用的 DOM 操作方法
    safeRemove(node) {
      if (node && node.parentNode) {
        node.parentNode.removeChild(node);
      }
    }
  },

  // 性能优化工具
  performance: {
    debounce(fn, wait) {
      let timeout;
      return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn.apply(this, args), wait);
      };
    },

    throttle(fn, limit) {
      let inThrottle;
      return function(...args) {
        if (!inThrottle) {
          fn.apply(this, args);
          inThrottle = true;
          setTimeout(() => inThrottle = false, limit);
        }
      };
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
    }
  }
}; 