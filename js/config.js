const createHighlighterConfig = () => {
  const config = {
    // 默认的样式类名
    className: 'chrome-extension-mutihighlight',
    stylePrefix: 'chrome-extension-mutihighlight-style-',

    // 批处理配置
    batchSize: 50,

    // 需要跳过的标签配置
    skipTags: {
      // 系统级标签，只跳过真正不应该高亮的标签
      system: ['SCRIPT', 'STYLE', 'NOSCRIPT'],

      // 可编辑标签的处理规则
      editableTags: ['INPUT', 'TEXTAREA'],
    },

    // 节点过滤规则
    filterRules: {
      // 检查标签是否应该跳过
      shouldSkipTag(node) {
        // 只过滤 script 和 style 标签及其子元素
        return node.tagName && (
          ['SCRIPT', 'STYLE'].includes(node.tagName) ||
          (node.parentNode && ['SCRIPT', 'STYLE'].includes(node.parentNode.tagName))
        );
      },

      // 检查是否允许高亮
      shouldAllowInput(element) {
        // 只检查是否可编辑
        return !(element && (
          element.parentNode && element.parentNode.isContentEditable ||
          element.isContentEditable
        ));
      },

      // 检查元素是否可编辑
      isEditable(node, root) {
        // 检查节点到根节点路径上是否有可编辑元素或 style/script
        while (node && node !== root) {
          if (node.tagName && (
            node.isContentEditable ||
            ['STYLE', 'SCRIPT'].includes(node.tagName)
          )) return true;
          node = node.parentNode;
        }
        return false;
      }
    },
    
    // 性能优化配置
    performance: {
      calculateBatchSize: (defaultSize = 100) => {
        // 根据页面状态动态调整批处理大小
        if (document.readyState === 'complete') {
          return Math.min(defaultSize, 50);  // 增加完整加载后的批次大小
        }
        return Math.min(defaultSize, 30);    // 增加初始加载的批次大小
      },
      
      // 优化处理时间配置
      processDelay: 8,         // 与节流延迟保持一致
      maxBatchTime: 16,        // 减少到一帧的处理时间,保持流畅
      idleTimeout: 16,         // 减少空闲超时
      throttleDelay: 8,        // 节流延迟
      
      // 初始化配置
      initialDelay: 0,         // 保持立即开始
      initialBatchSize: 30    // 显著增加初始批次大小
    }
  };


  return config;
};

// 确保配置在不同环境下都可用
(function(global) {
  // 创建配置实例
  const config = createHighlighterConfig();
  
  // 绑定过滤规则中的this
  Object.values(config.filterRules).forEach(fn => {
    if (typeof fn === 'function') {
      config.filterRules[fn.name] = fn.bind(config);
    }
  });

  // 导出配置
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = config;
  } else {
    global.HighlighterConfig = config;
  }
})(typeof window !== 'undefined' ? window : global);
