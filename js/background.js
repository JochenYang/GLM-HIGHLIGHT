// 统一的缓存管理器
class CacheManager {
  constructor(options = {}) {
    this.cache = new Map();
    this.ttl = options.ttl || 5 * 60 * 1000; // 5分钟
    this.maxAge = options.maxAge || 30 * 60 * 1000; // 30分钟
    this.maxSize = options.maxSize || 1000;
    this.cleanupInterval = options.cleanupInterval || 2 * 60 * 1000;
    
    // 启动定时清理
    this.cleanupTimer = setInterval(() => this.cleanup(), this.cleanupInterval);
  }

  set(key, value) {
    // 检查缓存大小
    if (this.cache.size >= this.maxSize) {
      const oldestKey = Array.from(this.cache.keys())
        .sort((a, b) => this.cache.get(a).timestamp - this.cache.get(b).timestamp)[0];
      this.cache.delete(oldestKey);
    }
    
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      lastAccessed: Date.now()
    });
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    const now = Date.now();
    if (now - item.timestamp > this.maxAge) {
      this.cache.delete(key);
      return null;
    }
    
    // 更新访问时间
    item.lastAccessed = now;
    return item.value;
  }

  cleanup() {
    const now = Date.now();
    for (const [key, item] of this.cache) {
      if (now - item.timestamp > this.maxAge || 
        now - item.lastAccessed > this.ttl) {
        this.cache.delete(key);
      }
    }
  }

  clear() {
    this.cache.clear();
  }

  destroy() {
    clearInterval(this.cleanupTimer);
    this.clear();
  }
}

const background = {
  USER_ID_STORE: "userUUID",
  ACTIVE_STATUS_STORE: "isActive",
  KEYWORDS_STRING_STORE: "fwm_keywordsString",
  KEYWORDS_ARRAY_STORE: "fwm_keywordsArray",
  TAB_ACTIVE_STATUS: "tabActiveStatus",
  
  // 使用新的缓存管理器
  _cache: new CacheManager({
    ttl: 5 * 60 * 1000,
    maxSize: 1000,
    cleanupInterval: 2 * 60 * 1000
  }),
  
  tabActiveStatus: new Map(),

  async setLocalStorage(key, value) {
    try {
      const oldValue = await this.getLocalStorage(key);
      if (oldValue === value) return;

      await chrome.storage.local.set({[key]: value});
      this._cache.set(key, value);

      await this._broadcastChange(key, value);
    } catch (error) {
      Utils.handleError(error, 'setLocalStorage');
    }
  },

  async getLocalStorage(key) {
    try {
      const cached = this._cache.get(key);
      if (cached !== null) return cached;

      const result = await chrome.storage.local.get(key);
      this._cache.set(key, result[key]);
      return result[key];
    } catch (error) {
      Utils.handleError(error, 'getLocalStorage');
      return null;
    }
  },

  async _broadcastChange(key, value) {
    try {
      const [activeTab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
        url: ["http://*/*", "https://*/*"]
      });
      
      if (activeTab?.id) {
        await chrome.tabs.sendMessage(activeTab.id, {
          opt: "event",
          event: "storageChange",
          args: {key, value}
        }).catch(() => {});
      }
    } catch (error) {
      Utils.handleError(error, 'broadcastChange');
    }
  },

  // 统一的消息验证
  _verifyMessage(message) {
    if (!message || typeof message !== 'object') return false;
    if (!message.opt || !message.func) return false;
    if (message.opt !== 'rpc') return false;
    if (typeof this[message.func] !== 'function') return false;
    return true;
  },

  async setKeywordsString2(keywords, options = {}) {
    try {
      // 处理关键词,确保同一个词只出现一次
      const wordMap = new Map(); 
      const processedKeywords = keywords.reduce((acc, item, idx) => {
        if (item.status === 1 && item.data) {
          const words = item.data.trim().split(/\s+/).filter(Boolean);
          words.forEach(word => {
            wordMap.set(word, {
              colour: item.colour,
              words: word,  
              categoryIndex: idx
            });
          });
        }
        return acc;
      }, []);

      // 将 Map 转换为数组,并按照 categoryIndex 排序
      const uniqueKeywords = Array.from(wordMap.values())
        .sort((a, b) => a.categoryIndex - b.categoryIndex);

      // 确保存储的是字符串格式
      const dataToStore = typeof keywords === 'string' ? keywords : JSON.stringify(keywords);
      await this.setLocalStorage(this.KEYWORDS_STRING_STORE, dataToStore);
      await this.setKeywords(uniqueKeywords);

      return uniqueKeywords;
    } catch (error) {
      console.error('设置关键词字符串失败:', error);
      return null;
    }
  },

  async getKeywords() {
    return await this.getLocalStorage(this.KEYWORDS_ARRAY_STORE);
  },

  async setKeywords(keywords) {
    try {
      await this.setLocalStorage(this.KEYWORDS_ARRAY_STORE, keywords);
    } catch (error) {
      console.error('设置关键词失败:', error);
    }
  },

  async setTabActiveStatus(tabId, status) {
    try {
      this.tabActiveStatus.set(tabId, status);
      await this.setLocalStorage(`${this.TAB_ACTIVE_STATUS}_${tabId}`, status);
      await this.setLocalStorage(this.ACTIVE_STATUS_STORE, status ? "true" : "false");
    } catch (error) {
      console.error('设置标签页状态失败:', error);
    }
  },

  async getTabActiveStatus(tabId) {
    try {
      // 先获取全局状态
      const globalStatus = await this.getActiveStatus();
      if (!globalStatus) {
        return false;  // 如果全局状态是关闭的，标签页状态也一定是关闭的
      }

      // 如果全局状态是开启的，再检查标签页状态
      if (this.tabActiveStatus.has(tabId)) {
        return this.tabActiveStatus.get(tabId);
      }
      
      const status = await this.getLocalStorage(`${this.TAB_ACTIVE_STATUS}_${tabId}`);
      if (status !== null && status !== undefined) {
        this.tabActiveStatus.set(tabId, status);
        return status;
      }

      // 如果没有找到标签页状态，使用全局状态
      this.tabActiveStatus.set(tabId, globalStatus);
      await this.setLocalStorage(`${this.TAB_ACTIVE_STATUS}_${tabId}`, globalStatus);
      
      return globalStatus;
    } catch (error) {
      console.error('获取标签页状态失败:', error);
      return false;
    }
  },

  generateUUID() {
    const lut = Array(256).fill().map((_, i) => (i < 16 ? '0' : '') + (i).toString(16));
    return () => {
      const d0 = Math.random() * 0xffffffff | 0;
      const d1 = Math.random() * 0xffffffff | 0;
      const d2 = Math.random() * 0xffffffff | 0;
      const d3 = Math.random() * 0xffffffff | 0;
      return `${lut[d0 & 0xff] + lut[d0 >> 8 & 0xff] + lut[d0 >> 16 & 0xff] + lut[d0 >> 24 & 0xff]}-${
        lut[d1 & 0xff]}${lut[d1 >> 8 & 0xff]}-${lut[d1 >> 16 & 0x0f | 0x40]}${lut[d1 >> 24 & 0xff]}-${
        lut[d2 & 0x3f | 0x80]}${lut[d2 >> 8 & 0xff]}-${lut[d2 >> 16 & 0xff]}${lut[d2 >> 24 & 0xff]}${
        lut[d3 & 0xff]}${lut[d3 >> 8 & 0xff]}${lut[d3 >> 16 & 0xff]}${lut[d3 >> 24 & 0xff]}`;
    };
  },

  async getUserId() {
    try {
      let userUUID = await this.getLocalStorage(this.USER_ID_STORE);
      if (!userUUID) {
        userUUID = this.generateUUID();
        await this.setLocalStorage(this.USER_ID_STORE, userUUID);
      }
      return userUUID;
    } catch (error) {
      console.error('获取用户ID失败:', error);
      return null;
    }
  },

  async getActiveStatus() {
    try {
      const status = await this.getLocalStorage(this.ACTIVE_STATUS_STORE);
      return status === "true";
    } catch (error) {
      console.error('获取激活状态失败:', error);
      return true;
    }
  },

  async setActiveStatus(status) {
    try {
      await this.setLocalStorage(this.ACTIVE_STATUS_STORE, status ? "true" : "false");
      
      const [activeTab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
        url: ["http://*/*", "https://*/*"]
      });
      
      if (activeTab) {
        this.tabActiveStatus.set(activeTab.id, status);
        await this.setLocalStorage(`${this.TAB_ACTIVE_STATUS}_${activeTab.id}`, status);
      }
    } catch (error) {
      console.error('设置激活状态失败:', error);
    }
  },

  async getKeywordsString() {
    try {
      return await this.getLocalStorage(this.KEYWORDS_STRING_STORE) || "";
    } catch (error) {
      console.error('获取关键词字符串失败:', error);
      return "";
    }
  },

  async getKeywordsString2() {
    try {
      const data = await this.getLocalStorage(this.KEYWORDS_STRING_STORE);
      if (!data) return [];
      
      // 如果已经是对象就直接返回,否则尝试解析
      return typeof data === 'object' ? data : JSON.parse(data);
    } catch (error) {
      console.error('获取关键词字符串2失败:', error);
      return [];
    }
  },

  async reapplyHighlights() {
    try {
      const [activeTab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
        url: ["http://*/*", "https://*/*"]
      });
      
      if (activeTab) {
        await chrome.tabs.sendMessage(activeTab.id, {
          opt: "event",
          event: "reapplyHighlights"
        }).catch(() => {});
      }
    } catch (error) {
      console.warn('Reapply highlights failed:', error);
    }
  },

  // 优化消息处理的批处理
  async processBatchMessages(messages) {
    const batchSize = this.config.performance.calculateBatchSize();
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);
      await Promise.all(batch.map(msg => this.processMessage(msg)));
      
      // 使用配置的延迟
      await new Promise(resolve => 
        setTimeout(resolve, this.config.performance.processDelay)
      );
    }
  }
};

// 处理消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!background._verifyMessage(message)) {
    sendResponse({ error: '无效的消息格式' });
    return;
  }

  (async () => {
    try {
      const result = await background[message.func].apply(
        background, 
        message.args || []
      );
      sendResponse(result);
    } catch (error) {
      console.error('消息处理器错误:', error);
      sendResponse({ error: error.message });
    }
  })();
  return true;
});

// 标签页事件处理
chrome.tabs.onRemoved.addListener((tabId) => {
  background.tabActiveStatus.delete(tabId);
  chrome.storage.local.remove(`${background.TAB_ACTIVE_STATUS}_${tabId}`);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.match(/^(http|https|file):\/\//)) {
    const status = await background.getTabActiveStatus(tabId);
    background.tabActiveStatus.set(tabId, status);
  }
});

// 注册右键菜单和初始化插件
chrome.runtime.onInstalled.addListener(async () => {
  try {
    // 先获取当前状态,使用正确的键名
    const currentStatus = await chrome.storage.local.get([background.ACTIVE_STATUS_STORE]);
    
    // 只设置插件状态为启用,不创建默认分类
    if (!currentStatus[background.ACTIVE_STATUS_STORE]) {
      await chrome.storage.local.set({
        [background.ACTIVE_STATUS_STORE]: "true"  // 使用字符串"true"保持一致性
      });
    }

    // 创建右键菜单
    chrome.contextMenus.create({
      id: 'add-to-category',
      title: '添加到高亮分类',
      contexts: ['selection']
    });

    chrome.contextMenus.create({
      id: 'remove-highlight',
      title: '删除高亮',
      contexts: ['selection']
    });

  } catch (error) {
    console.error('初始化插件失败:', error);
  }
});

// 处理右键菜单点击
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'add-to-category') {
    chrome.tabs.sendMessage(tab.id, {
      type: 'add-to-category'
    });
  } else if (info.menuItemId === 'remove-highlight') {
    chrome.tabs.sendMessage(tab.id, {
      type: 'remove-highlight'
    });
  }
});

// 处理快捷键
chrome.commands.onCommand.addListener((command, tab) => {
  if (command === 'add-to-category') {
    chrome.tabs.sendMessage(tab.id, {
      type: 'add-to-category'
    });
  } else if (command === 'remove-highlight') {
    chrome.tabs.sendMessage(tab.id, {
      type: 'remove-highlight'
    });
  }
});
