const createHighlighterConfig = () => {
  const config = {
    // 默认的样式类名
    className: "chrome-extension-mutihighlight",
    stylePrefix: "chrome-extension-mutihighlight-style-",

    // 过滤规则
    filterRules: {
      shouldSkipTag(node) {
        return (
          node.tagName &&
          (["SCRIPT", "STYLE", "NOSCRIPT"].includes(node.tagName) ||
            node.isContentEditable ||
            (node.parentNode && node.parentNode.isContentEditable))
        );
      },

      shouldAllowInput(element) {
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

    // 精简后的性能配置
    performance: {
      // 批处理相关
      batch: {
        size: 50,  // 默认批处理大小
        maxNodes: 1000  // 单次处理最大节点数
      },

      // 防抖配置
      debounce: {
        input: 500,   // 输入防抖
        update: 500   // 更新防抖
      },

      // 保留基础节流配置
      throttle: {
        default: 100  // 默认节流时间
      }
    }
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
