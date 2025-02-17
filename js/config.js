const createHighlighterConfig = () => {
  const config = {
    // 默认的样式类名
    className: "chrome-extension-mutihighlight",
    stylePrefix: "chrome-extension-mutihighlight-style-",

    // 过滤规则优化
    filterRules: {
      // 检查标签是否应该跳过
      shouldSkipTag(node) {
        // 只过滤必要的标签
        return (
          node.tagName &&
          (["SCRIPT", "STYLE", "NOSCRIPT"].includes(node.tagName) ||
            node.isContentEditable ||
            (node.parentNode && node.parentNode.isContentEditable))
        );
      },

      // 改回原来的函数名，但保持优化的逻辑
      shouldAllowInput(element) {
        // 改回原函数名
        // 检查是否可编辑或在特殊标签内
        return !(
          element &&
          (element.isContentEditable ||
            ["INPUT", "TEXTAREA"].includes(element.tagName) ||
            (element.parentNode &&
              ["SCRIPT", "STYLE", "NOSCRIPT"].includes(
                element.parentNode.tagName
              )))
        );
      },

      // 添加回这个必要的函数
      isEditable(node, root) {
        while (node && node !== root) {
          if (
            node.tagName &&
            (node.isContentEditable ||
              ["STYLE", "SCRIPT", "NOSCRIPT"].includes(node.tagName))
          )
            return true;
          node = node.parentNode;
        }
        return false;
      },
    },

    // 性能配置精简
    performance: {
      // 批处理相关
      batch: {
        size: 50, // 默认批处理大小
        maxNodes: 1000, // 单次处理最大节点数
      },

      // 防抖配置
      debounce: {
        input: 500, // 输入防抖
        update: 500, // 更新防抖
      },

      // 节流配置
      throttle: {
        mutation: 100, // DOM变化节流
        highlight: 100, // 高亮处理节流
      },

      // 缓存配置
      cache: {
        maxSize: 1000, // 最大缓存条目数
      },
    },
  };

  return config;
};

// 导出配置
(function (global) {
  const config = createHighlighterConfig();

  // 绑定过滤规则中的this
  Object.values(config.filterRules).forEach((fn) => {
    if (typeof fn === "function") {
      config.filterRules[fn.name] = fn.bind(config);
    }
  });

  global.HighlighterConfig = config;
})(typeof window !== "undefined" ? window : global);
