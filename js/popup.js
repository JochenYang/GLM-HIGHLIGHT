let listData = [];
let indexFlag;

// 添加输入缓冲区管理
let inputBuffer = "";
let isComposing = false; // 用于处理中文输入法

// 添加拖拽相关变量
let dragStartIndex;
let dragEndIndex;
let isDragging = false;

$(function () {
  // 缓存常用的DOM选择器
  const $textBox = $("#text-box");
  const $switcher = $("#switcher");
  const $colorBox = $(".colorBox");

  // 使用 Utils 中的函数替换
  function sanitizeInput(input) {
    return input.replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        }[char])
    );
  }

  // 使用 Utils.verifyMessage
  function verifyMessage(message) {
    return Utils.verifyMessage(message);
  }

  // 使用 Utils.debounce
  const debouncedUpdateKeywords = Utils.debounce(async function (newData) {
    try {
      // 确保数据格式正确
      if (Array.isArray(newData)) {
        await chrome.runtime.sendMessage({
          opt: "rpc",
          func: "setKeywordsString2",
          args: [newData],
        });

        // 获取完整的关键词后再触发高亮更新
        const keywords = await chrome.runtime.sendMessage({
          opt: "rpc",
          func: "getKeywords",
        });

        // 通知内容脚本更新高亮
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });

        if (tab) {
          await chrome.tabs
            .sendMessage(tab.id, {
              opt: "event",
              event: "storageChange",
              args: {
                key: "fwm_keywordsArray",
                value: keywords,
              },
            })
            .catch(() => {});
        }
      }
    } catch (error) {
      console.error("更新关键词失败:", error);
    }
  }, 500); // 增加防抖时间到500ms,给用户更多输入时间

  // 使用 Utils.throttle
  const throttledFunction = Utils.throttle(function () {
    // ... 原有的节流函数逻辑 ...
  }, 1000);

  // 加消息验证
  function verifyMessage(message) {
    // 验证消息格式和来源
    if (!message || typeof message !== "object") return false;
    return true;
  }

  // 优化的防抖函数实现
  function debounce(func, wait) {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  // 优化的节流函数实现
  function throttle(func, limit) {
    let inThrottle;
    return function (...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  }

  // 优化后台页面连接
  async function getBackgroundPage() {
    try {
      const response = await chrome.runtime.sendMessage({
        opt: "rpc",
        func: "getKeywordsString2",
      });
      return response || [];
    } catch (error) {
      console.error("获取后台页面失败:", error);
      return [];
    }
  }

  // 修改关键词更新函数
  async function updateKeywords(listData, options = {}) {
    try {
      // 先更新存储
      await chrome.runtime.sendMessage({
        opt: "rpc",
        func: "setKeywordsString2",
        args: [listData],
      });

      // 只通知当前标签页更新
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (tab) {
        const keywords = await chrome.runtime.sendMessage({
          opt: "rpc",
          func: "getKeywords",
        });

        await chrome.tabs
          .sendMessage(tab.id, {
            opt: "event",
            event: "storageChange",
            args: {
              key: "fwm_keywordsArray",
              value: keywords,
            },
          })
          .catch(() => {});
      }
    } catch (error) {
      console.error("Error updating keywords:", error);
      throw error;
    }
  }

  // 优化的关键词更新处理
  const handleKeywordInput = Utils.debounce(async function (
    element,
    categoryIndex
  ) {
    try {
      const value = element.value.trim();

      // 如果正在输入中文或者输入缓冲区非空且没有空格，不触发更新
      if (isComposing || (inputBuffer && !value.includes(" "))) {
        return;
      }

      // 更新数据
      if (listData[categoryIndex]) {
        listData[categoryIndex].data = value;
        await debouncedUpdateKeywords(listData);
      }

      // 清空缓冲区
      inputBuffer = "";
    } catch (error) {
      console.error("处理关键词输入失败:", error);
    }
  },
  500);

  // 监听输入事件
  $(document).on("input", ".keyword-input", function (e) {
    const $input = $(this);
    const categoryIndex = $input.data("category");
    inputBuffer = e.target.value;
    handleKeywordInput(this, categoryIndex);
  });

  // 处理中文输入法
  $(document).on("compositionstart", ".keyword-input", () => {
    isComposing = true;
  });

  $(document).on("compositionend", ".keyword-input", function (e) {
    isComposing = false;
    handleKeywordInput(this, $(this).data("category"));
  });

  // 修改文本输入处理
  $textBox.on("input", ".content", function () {
    const index = Array.from(document.querySelectorAll(".content")).indexOf(
      this
    );
    const newValue = this.value;

    // 直接更新数据,不做分割处理
    if (listData[index].data !== newValue) {
      listData[index].data = newValue;

      // 立即触发更新
      debouncedUpdateKeywords(listData);

      updateWordsCount();

      // 处理清空情况
      if (!newValue.trim()) {
        const isLastCategory = index === listData.length - 1;
        if (isLastCategory) {
          chrome.tabs
            .query({
              url: ["http://*/*", "https://*/*"],
            })
            .then((tabs) => {
              tabs.forEach((tab) => {
                chrome.tabs
                  .sendMessage(tab.id, {
                    opt: "event",
                    event: "clearHighlights",
                  })
                  .catch(() => {});
              });
            });
        }
      }
    }
  });

  // 修改输入法完成事件处理
  $textBox.on("compositionend", ".content", function () {
    const index = Array.from(document.querySelectorAll(".content")).indexOf(
      this
    );
    const newValue = this.value;

    if (listData[index].data !== newValue) {
      listData[index].data = newValue;

      // 立即触发更新
      debouncedUpdateKeywords(listData);

      updateWordsCount();
    }
  });

  // 优化颜色选择器定位
  const throttledPositionColorBox = throttle(function ($colorBox, $target) {
    const targetRect = $target[0].getBoundingClientRect();
    const colorBoxRect = $colorBox[0].getBoundingClientRect();
    const viewportHeight = window.innerHeight;

    let top = targetRect.bottom + 5;
    if (top + colorBoxRect.height > viewportHeight) {
      top = targetRect.top - colorBoxRect.height - 5;
    }

    $colorBox.css({
      top: `${top}px`,
      left: `${targetRect.left}px`,
    });
  }, 16);

  // 修改renderListItems函数
  function renderListItems(items) {
    const fragment = document.createDocumentFragment();

    items.forEach((data) => {
      const $item = $(listItemTemplate);

      // 设置内容和名称
      $item.find(".content").val(data.data || "");
      $item.find(".textName").val(data.name || "");

      // 设置颜色
      $item
        .find(".colorSelect")
        .removeClass((_, className) =>
          (
            className.match(
              /(^|\s)chrome-extension-mutihighlight-style-\S+/g
            ) || []
          ).join(" ")
        )
        .addClass(`chrome-extension-mutihighlight-style-${data.colour || 1}`);

      // 设置开关状态
      const $setBtn = $item.find(".setBtn");
      const status = data.status === 1;
      $setBtn.attr("data-on", String(status));
      $setBtn.find(".el-switch__core").css({
        "background-color": status ? "var(--el-color-primary)" : "#dcdfe6",
        "border-color": status ? "var(--el-color-primary)" : "#dcdfe6",
      });

      fragment.appendChild($item[0]);
    });

    $textBox.empty().append(fragment);

    // 渲染完成后初始化拖拽
    initDragAndDrop();
  }

  // 修改 initialize 函数的实现
  async function initialize() {
    try {
      // 预先加载数据
      const [backgroundPage, activeStatus] = await Promise.all([
        chrome.runtime.sendMessage({
          opt: "rpc",
          func: "getKeywordsString2",
        }),
        chrome.runtime.sendMessage({
          opt: "rpc",
          func: "getActiveStatus",
        }),
      ]);

      // 设置开关状态
      $("#switcher").prop("checked", activeStatus === "true");

      // 准备好数据后一次性显示
      requestAnimationFrame(() => {
        // 设置开关状态 - 直接使用布尔值
        $switcher.attr("data-on", String(activeStatus)); // 转为字符串
        if (activeStatus) {
          // 直接用布尔值判断
          $switcher.find(".el-switch__core").css({
            "background-color": "var(--el-color-primary)",
            "border-color": "var(--el-color-primary)",
          });
        }

        // 渲染列表数据
        if (Array.isArray(backgroundPage) && backgroundPage.length) {
          listData = backgroundPage;
          renderListItems(backgroundPage); // 这里会调用initDragAndDrop
        } else {
          listData = [
            {
              colour: 1,
              data: "",
              status: 1,
              name: "",
            },
          ];
          $textBox.empty().append(listItemTemplate);
          initDragAndDrop(); // 这里也需要初始化拖拽
        }

        // 更新统计信息
        updateWordsCount();
      });
    } catch (error) {
      console.error("初始化失败:", error);
    }
  }

  // 添加重试机制
  async function retryInitialize(retryCount = 0) {
    const maxRetries = 3;
    const retryDelay = 1000; // 1秒延迟

    try {
      if (retryCount >= maxRetries) {
        showToast("初始化失败，请刷新重试", "error");
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, retryDelay));
      await initialize();
    } catch (error) {
      console.error(`Retry ${retryCount + 1} failed:`, error);
      await retryInitialize(retryCount + 1);
    }
  }

  // 修改删除关键词的处理
  $textBox.on("click", ".rem", async function (e) {
    e.preventDefault();

    const $item = $(this).closest(".highlight-item");
    const index = $(".rem").index(this);

    try {
      // 禁用所有删除按钮
      $(".rem").prop("disabled", true);

      // 准备新数据
      const newListData = listData.filter((_, i) => i !== index);

      // 更新数据和计数
      listData = newListData;
      updateWordsCount();

      // 异步更新数据
      await updateKeywords(newListData, {
        type: "removeCategory",
        index: index,
      });

      // 更新UI
      $item.fadeOut(200, function () {
        $(this).remove();
      });
    } catch (error) {
      console.error("Error removing category:", error);
      showToast("删除失败，请重试", "error");
    } finally {
      $(".rem").prop("disabled", false);
    }
  });

  // 加一个标志来跟踪是否有操作正在进行
  let isProcessing = false;

  $textBox.on("click", ".setBtn", async function (e) {
    e.preventDefault();
    e.stopPropagation();

    if (isProcessing) return;

    const $btn = $(this);
    const index = $(".setBtn").index(this);
    const currentStatus = $btn.attr("data-on") === "true";
    const newStatus = !currentStatus;

    try {
      isProcessing = true;
      $btn.css("pointer-events", "none");

      // 立即更新UI状态
      $btn.attr("data-on", String(newStatus));
      $btn.find(".el-switch__core").css({
        "background-color": newStatus ? "var(--el-color-primary)" : "#dcdfe6",
        "border-color": newStatus ? "var(--el-color-primary)" : "#dcdfe6",
      });

      // 更新数据
      listData[index].status = newStatus ? 1 : 0;

      // 等待更新完成并获取新的关键词数组
      await chrome.runtime.sendMessage({
        opt: "rpc",
        func: "setKeywordsString2",
        args: [listData],
      });

      // 获取当前标签页
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (tab) {
        // 获更新后的关键词数组
        const keywords = await chrome.runtime.sendMessage({
          opt: "rpc",
          func: "getKeywords",
        });

        // 通知标签页更新高亮
        await chrome.tabs
          .sendMessage(tab.id, {
            opt: "event",
            event: "storageChange",
            args: {
              key: "fwm_keywordsArray",
              value: keywords,
            },
          })
          .catch(() => {});
      }

      // 更新计数
      updateWordsCount();

      // 延迟关闭处理状态
      $btn.css("pointer-events", "");
      isProcessing = false;
    } catch (error) {
      console.error("Error toggling category:", error);
      // 恢复原状态
      $btn.attr("data-on", String(currentStatus));
      $btn.find(".el-switch__core").css({
        "background-color": currentStatus
          ? "var(--el-color-primary)"
          : "#dcdfe6",
        "border-color": currentStatus ? "var(--el-color-primary)" : "#dcdfe6",
      });
      listData[index].status = currentStatus ? 1 : 0;
      showToast("操作失败，请重试", "error");
      isProcessing = false;
      $btn.css("pointer-events", "");
    }
  });

  $textBox.on("keyup", ".textName", function () {
    const index = $(".textName").index(this);
    const value = $.trim(this.value);
    listData[index].name = value;
    $(this).attr("title", value);
    debouncedUpdateKeywords(listData);
  });

  // 颜色选择处理
  let colorBoxVisible = false;
  $(document).on("click", function (e) {
    if (!$(e.target).closest(".colorSelect, .colorBox").length) {
      $(".colorBox").fadeOut(200);
      colorBoxVisible = false;
    }
  });

  $textBox.on("click", ".colorSelect", function (e) {
    e.stopPropagation();

    const $colorBox = $(".colorBox");
    indexFlag = $(".colorSelect").index(this);

    // 计算位置
    const targetRect = this.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const colorBoxHeight = $colorBox.outerHeight();

    // 决定显示在目标元素的上方还是下方
    let top = targetRect.bottom + 5;
    if (top + colorBoxHeight > viewportHeight) {
      top = targetRect.top - colorBoxHeight - 5;
    }

    // 设置位置并显示
    $colorBox
      .css({
        position: "fixed",
        top: `${top}px`,
        left: `${targetRect.left}px`,
        zIndex: 1000,
      })
      .fadeIn(200);
  });

  // 点击颜色选择器中的颜色
  $(document).on("click", ".color-picker__item", async function () {
    if (isProcessing) return;

    try {
      isProcessing = true;

      // 获取新的颜色索引
      const newColorIndex = $(this).index() + 1;
      const $target = $(".colorSelect").eq(indexFlag);

      // 立即更新UI
      $target
        .removeClass(function (index, className) {
          return (
            className.match(
              /(^|\s)chrome-extension-mutihighlight-style-\d+/g
            ) || []
          ).join(" ");
        })
        .addClass(`chrome-extension-mutihighlight-style-${newColorIndex}`);

      // 更新数据
      listData[indexFlag].colour = newColorIndex;

      // 获取当前标签页
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (tab) {
        // 立即发送消息到当前标签页
        await chrome.tabs
          .sendMessage(tab.id, {
            opt: "event",
            event: "colorChange",
            args: {
              index: indexFlag,
              color: newColorIndex,
            },
          })
          .catch(() => {});
      }

      // 异步更新存储
      await chrome.runtime.sendMessage({
        opt: "rpc",
        func: "setKeywordsString2",
        args: [listData],
      });

      // 隐藏颜色选择器
      $(".colorBox").fadeOut(200);
    } catch (error) {
      console.error("Error updating color:", error);
    } finally {
      isProcessing = false;
    }
  });

  // 修改添加分类的处理
  $("#add").on("click", async function () {
    try {
      // 创建新分类数据
      const newCategory = {
        colour: 1,
        data: "",
        status: 1,
        name: "",
      };

      // 添加到listData开头
      listData.unshift(newCategory); // 使用unshift而不是push

      // 渲染新分类
      const $newItem = $(listItemTemplate);

      // 设置初始状态
      $newItem
        .find(".colorSelect")
        .addClass("chrome-extension-mutihighlight-style-1");
      $newItem
        .find(".setBtn")
        .attr("data-on", "true")
        .find(".el-switch__core")
        .css({
          "background-color": "var(--el-color-primary)",
          "border-color": "var(--el-color-primary)",
        });

      // 添加到列表开头
      $("#text-box").prepend($newItem); // 使用prepend而不是append

      // 重新初始化拖拽
      initDragAndDrop();

      // 立即保存更新
      await chrome.runtime.sendMessage({
        opt: "rpc",
        func: "setKeywordsString2",
        args: [listData],
      });

      // 更新统计信息
      updateWordsCount();

      // 自动滚动到顶部
      $("#text-box").scrollTop(0);
    } catch (error) {
      console.error("添加分类失败:", error);
    }
  });

  // 添加一消息送重试函数
  async function sendMessageWithRetry(tabId, message, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        await chrome.tabs.sendMessage(tabId, message);
        return;
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
  }

  // 总开关处理
  $switcher.on("click", async function (e) {
    e.preventDefault();
    e.stopPropagation();

    if (isProcessing) return;

    const $btn = $(this);
    const currentStatus = $btn.attr("data-on") === "true";
    const newStatus = !currentStatus;

    try {
      isProcessing = true;
      $btn.css("pointer-events", "none");

      // 立即更新UI状态
      $btn.attr("data-on", String(newStatus));
      $btn.find(".el-switch__core").css({
        "background-color": newStatus ? "var(--el-color-primary)" : "#dcdfe6",
        "border-color": newStatus ? "var(--el-color-primary)" : "#dcdfe6",
      });

      // 获取当前标签页
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
        url: ["http://*/*", "https://*/*"],
      });

      if (tab) {
        // 更新后台状态
        await chrome.runtime.sendMessage({
          opt: "rpc",
          func: "setActiveStatus",
          args: [newStatus],
        });

        // 更新标签页状态
        await chrome.runtime.sendMessage({
          opt: "rpc",
          func: "setTabActiveStatus",
          args: [tab.id, newStatus],
        });

        // 通知标签页更新
        await chrome.tabs
          .sendMessage(tab.id, {
            opt: "event",
            event: "storageChange",
            args: {
              key: "isActive",
              value: newStatus,
            },
          })
          .catch(() => {});
      }
    } catch (error) {
      console.error("Error toggling main switch:", error);
      // 恢复原状态
      $btn.attr("data-on", String(currentStatus));
      $btn.find(".el-switch__core").css({
        "background-color": currentStatus
          ? "var(--el-color-primary)"
          : "#dcdfe6",
        "border-color": currentStatus ? "var(--el-color-primary)" : "#dcdfe6",
      });
    } finally {
      isProcessing = false;
      $btn.css("pointer-events", "");
    }
  });

  // 支持链接处理
  $("#support-link").click(() => {
    chrome.tabs.create({ url: "https://www.geluman.cn/highlight.html" });
  });

  // 修改分享对话框 HTML
  const dialogHtml = `
        <div id="shareDialog" class="el-dialog" style="display:none">
            <div class="el-dialog__header">
                <h3>分享配置</h3>
            </div>
            
            <div class="el-dialog__body">
                <div class="dialog-section">
                    <div class="dialog-label">分码</div>
                    <div class="dialog-input-group">
                        <input id="shareCode" type="text" readonly class="el-input__inner">
                        <button id="copyCode" class="el-button el-button--primary">复制</button>
                    </div>
                </div>
                
                <div class="dialog-section">
                    <div class="dialog-label">导入分享码</div>
                    <div class="dialog-input-group">
                        <input id="importCode" type="text" placeholder="请输入分享码" class="el-input__inner">
                        <button id="applyCode" class="el-button el-button--primary">应用</button>
                    </div>
                </div>
            </div>
            
            <div class="el-dialog__footer">
                <button id="closeDialog" class="el-button">关闭</button>
            </div>
        </div>
        
        <div id="overlay" class="el-overlay" style="display:none"></div>
    `;
  $("body").append(dialogHtml);

  // 修改去重按钮击事件处理
  $("#dedupe").click(async function () {
    if (!listData.length) return;

    // 用于存储所有词的第一次出现位置
    const wordMap = new Map();
    const duplicates = new Set(); // 用于记录重复词
    const originalData = JSON.parse(JSON.stringify(listData)); // 保存原始数据用于比较

    // 第一次遍历：记录每个词第一次出现的位置，并标记重复词
    listData.forEach((item, categoryIndex) => {
      if (!item.data || item.status !== 1) return;

      const words = item.data.trim().split(/\s+/).filter(Boolean);
      const uniqueWordsInCategory = new Set();

      words.forEach((word) => {
        // 直接使用原始词作为键，保持大小写敏感
        if (uniqueWordsInCategory.has(word)) {
          duplicates.add(word);
          return;
        }
        uniqueWordsInCategory.add(word);

        if (wordMap.has(word)) {
          duplicates.add(word);
        } else {
          wordMap.set(word, {
            categoryIndex: categoryIndex,
            word: word,
          });
        }
      });
    });

    // 更新数据：移除所有重复词，只保留每个词的第一次出现
    const newListData = listData.map((item, categoryIndex) => {
      if (!item.data || item.status !== 1) return item;

      const words = item.data.trim().split(/\s+/).filter(Boolean);
      const uniqueWords = Array.from(new Set(words)).filter((word) => {
        if (!duplicates.has(word)) {
          return true;
        }
        const firstOccurrence = wordMap.get(word);
        return (
          firstOccurrence && firstOccurrence.categoryIndex === categoryIndex
        );
      });

      return {
        ...item,
        data: uniqueWords.join(" "),
      };
    });

    // 检查哪些分类发生了变化
    const changedCategories = [];
    newListData.forEach((item, index) => {
      if (item.data !== originalData[index].data) {
        changedCategories.push(index);
      }
    });

    // 更新界面和后台
    try {
      // 只更新发生变化的分类
      changedCategories.forEach((index) => {
        $(`.content`)
          .eq(index)
          .val(newListData[index].data || "");
      });

      // 如果有变化才更新后台数据
      if (changedCategories.length > 0) {
        listData = newListData;

        await chrome.runtime.sendMessage({
          opt: "rpc",
          func: "setKeywordsString2",
          args: [listData],
        });

        // 只更新变化类的高亮
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });
        if (tab) {
          await chrome.runtime.sendMessage({
            opt: "rpc",
            func: "getKeywords",
          });

          await chrome.tabs.sendMessage(tab.id, {
            opt: "event",
            event: "partialUpdate",
            args: {
              categories: changedCategories,
              keywords: listData,
            },
          });
        }

        updateWordsCount();
        showToast(`去重成功！已移除 ${duplicates.size} 个重复词`);
      } else {
        showToast("没有发现重复词");
      }
    } catch (error) {
      console.error("Error updating keywords after deduplication:", error);
      showToast("去重失败，请重试", "error");
    }
  });

  // 修改导出功能实
  $("#export").click(function () {
    try {
      // 使用 requestAnimationFrame 避免界面卡顿
      requestAnimationFrame(async () => {
        // 准备导出数据
        const exportData = {
          version: "1.0",
          timestamp: Date.now(),
          data: listData,
        };

        // 使用 Blob URL 建下载
        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
          type: "application/json",
        });

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");
        a.download = `highlight-config-${year}-${month}-${day}.json`;

        // 触发下载
        a.click();

        // 延迟清理资源
        setTimeout(() => {
          URL.revokeObjectURL(url);
        }, 100);
      });
    } catch (error) {
      console.error("Error exporting data:", error);
      alert("导出失败请重试");
    }
  });

  // 移除重复的 fileInput change 事件处理程序
  $(document).off("change", "#fileInput");

  // 统一的文件导入处理
  $("#fileInput").change(function (e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function (e) {
      try {
        let importedData = JSON.parse(e.target.result);

        // 处理不同的数据格式
        if (importedData.data) {
          importedData = importedData.data;
        }

        // 验证数据格式
        if (!Array.isArray(importedData)) {
          throw new Error("无效的数据格式");
        }

        showCustomConfirm(
          "确定要导入配置吗？这将覆盖当前的所有配置。",
          async () => {
            try {
              // 清空当前列表
              $textBox.empty();

              // 确保数据格式正确
              listData = importedData.map((item) => ({
                colour: item.colour || 1,
                data: item.data || "",
                status: typeof item.status === "number" ? item.status : 1,
                name: item.name || "",
              }));

              // 使用优化后的渲染函数重新渲染列表
              renderListItems(listData);

              // 更新后台数据并强制刷新
              await chrome.runtime.sendMessage({
                opt: "rpc",
                func: "setKeywordsString2",
                args: [listData, { forceUpdate: true }],
              });

              // 重新获取关键词并更新
              const keywords = await chrome.runtime.sendMessage({
                opt: "rpc",
                func: "getKeywords",
              });

              // 获取当前标签页
              const [tab] = await chrome.tabs.query({
                active: true,
                currentWindow: true,
              });

              if (tab) {
                // 获取关键词并更新当前标签页
                await chrome.runtime.sendMessage({
                  opt: "rpc",
                  func: "getKeywords",
                });

                await chrome.tabs
                  .sendMessage(tab.id, {
                    opt: "event",
                    event: "storageChange",
                    args: {
                      key: "fwm_keywordsArray",
                      value: keywords,
                    },
                  })
                  .catch(() => {});
              }

              // 更新计数
              updateWordsCount();

              showToast("导入成功！");
            } catch (error) {
              console.error("Error importing data:", error);
              showToast("导入失败，确文件格式正确", "error");
            }
          }
        );
      } catch (error) {
        console.error("Error parsing import data:", error);
        showToast("导入失败，确文件格式正确", "error");
      }

      // 清理文件输入
      this.value = "";
    };

    reader.readAsText(file);
  });

  // 导入按钮点击事件
  $("#import").click(function () {
    $("#fileInput").click();
  });

  // 添加提示框
  function showToast(message, type = "success") {
    const toast = $(`
            <div style="
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                padding: 10px 20px;
                background: ${type === "success" ? "#67C23A" : "#F56C6C"};
                color: white;
                border-radius: 4px;
                z-index: 10000;
            ">${message}</div>
        `);

    $("body").append(toast);
    setTimeout(() => toast.fadeOut(() => toast.remove()), 2000);
  }

  // 生成分享码函数
  function generateShareCode(data) {
    try {
      // 确保包含完整的配置信息
      const shareData = data.map((item) => ({
        colour: item.colour, // 保留颜色信息
        data: item.data, // 高亮词
        status: item.status, // 启用状态
        name: item.name, // 分类名称
      }));

      // 压缩数据
      const jsonStr = JSON.stringify(shareData);
      const compressed = btoa(encodeURIComponent(jsonStr));
      // 生成8位机码
      const randomCode = Math.random().toString(36).substring(2, 10);
      return `${randomCode}-${compressed}`;
    } catch (error) {
      console.error("生成分享码失败:", error);
      return null;
    }
  }

  // 解析享码
  function parseShareCode(code) {
    try {
      const [_, compressed] = code.split("-");
      const jsonStr = decodeURIComponent(atob(compressed));
      return JSON.parse(jsonStr);
    } catch (error) {
      console.error("解析分享码失败:", error);
      return null;
    }
  }

  // 修改分享按钮点击事件
  $("#share").click(function () {
    const shareCode = generateShareCode(listData);
    if (shareCode) {
      $("#shareCode").val(shareCode);
      $("#shareDialog, #overlay").fadeIn(200);
    } else {
      showToast("生成分享码失败，请重试", "error");
    }
  });

  // 修改复制分码
  $("#copyCode").click(function () {
    const shareCode = $("#shareCode").val();
    navigator.clipboard
      .writeText(shareCode)
      .then(() => {
        showToast("分享码已复制到剪贴板");
        $("#shareDialog, #overlay").fadeOut(200); // 复制成功后自动关闭弹窗
      })
      .catch(() => {
        showToast("复制失败，请手动复制", "error");
      });
  });

  // 修改应用分享码
  $("#applyCode").click(async function () {
    const code = $("#importCode").val().trim();
    if (!code) {
      showToast("请输入分享码", "error");
      return;
    }

    try {
      const importedData = parseShareCode(code);
      if (!importedData || !Array.isArray(importedData)) {
        throw new Error("Invalid share code");
      }

      showCustomConfirm(
        "确定要应用这个配置吗？这将与当前配置合并。",
        async () => {
          try {
            // 合并配置
            const newData = [...listData];
            importedData.forEach((item) => {
              // 检查否已存在相同名称置
              const existingIndex = newData.findIndex(
                (existing) => existing.name === item.name
              );

              if (existingIndex === -1) {
                // 如果不存在，添加到列表
                newData.push({
                  colour: item.colour || 1,
                  data: item.data || "",
                  status: typeof item.status === "number" ? item.status : 1,
                  name: item.name || "",
                });
              } else {
                // 如果存在，合并词组
                const existing = newData[existingIndex];
                const existingWords = new Set(existing.data.split(/\s+/));
                const newWords = item.data.split(/\s+/);
                newWords.forEach((word) => existingWords.add(word));
                existing.data = Array.from(existingWords).join(" ");
              }
            });

            // 更数据
            listData = newData;

            // 清空并重新渲染列表
            $textBox.empty();
            renderListItems(listData);

            // 更新后台数据
            await chrome.runtime.sendMessage({
              opt: "rpc",
              func: "setKeywordsString2",
              args: [listData],
            });

            updateWordsCount();
            showToast("配置已成功应用！");
            $("#shareDialog, #overlay").fadeOut(200);
            $("#importCode").val("");
          } catch (error) {
            console.error("Error applying share code:", error);
            showToast("应用配置失败，请重试", "error");
          }
        }
      );
    } catch (error) {
      console.error("Error parsing share code:", error);
      showToast("分享码无效，请检查后重", "error");
    }
  });

  // 修改关闭按钮事件
  $("#closeDialog, #overlay").click(function () {
    $("#shareDialog, #overlay").fadeOut(200);
    $("#importCode").val("");
  });

  // 阻止对框内点事件冒泡
  $("#shareDialog").click(function (e) {
    e.stopPropagation();
  });

  // 修改更新高亮词数量的函数
  function updateWordsCount() {
    // 使用 Set 来存储唯一的词（大小写敏感）
    const uniqueWords = new Set();
    listData.forEach((item) => {
      if (item.status === 1 && item.data) {
        // 分词，大小写敏感
        item.data
          .trim()
          .split(/\s+/)
          .filter(Boolean)
          .forEach((word) => uniqueWords.add(word));
      }
    });
    // 显示实际的高亮词数量
    $(".footer__stats span:nth-child(2)").text(`高亮词: ${uniqueWords.size}`);
  }

  // 导入导出数据处理异步化
  async function processImportData(importedData) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const newData = [...listData];
        importedData.forEach((item) => {
          // 数据处理逻辑...
        });
        resolve(newData);
      }, 0);
    });
  }

  // 修改列表项板定义
  const listItemTemplate = `
        <div class="highlight-item">
            <div class="highlight-item__header">
                <input type="text" class="el-input__inner textName" 
                    maxlength="20" 
                    placeholder="请输入名称">
                
                <div class="colorSelect chrome-extension-mutihighlight-style-1" 
                    style="width:24px;height:24px;min-width:24px;min-height:24px;max-width:24px;max-height:24px;aspect-ratio:1;flex:0 0 24px;">
                </div>
                
                <div class="el-switch setBtn" data-on="true">
                    <span class="el-switch__core"></span>
                </div>
                
                <button class="el-button rem" style="padding:8px;margin:0">
                    <img src="img/delete.png" style="width:20px;height:20px;">
                </button>
            </div>
            
            <div class="highlight-item__content">
                <textarea class="content" 
                    placeholder="请输入高亮词，多个以空格隔开"></textarea>
            </div>
        </div>
    `;

  // 修改拖拽初始化函数
  function initDragAndDrop() {
    const container = $("#text-box");

    container.find(".highlight-item").each((index, item) => {
      const $item = $(item);

      $item.on("mousedown", (e) => {
        // 排除所有交互元素
        if (
          $(e.target).is(
            "input, textarea, button, .colorSelect, .setBtn, .rem"
          ) ||
          $(e.target).closest(".colorSelect, .setBtn, .rem").length
        ) {
          return;
        }

        e.preventDefault();
        dragStartIndex = $item.index();
        isDragging = true;

        // 创建克隆元素并保持原始尺寸
        const $clone = $item.clone().addClass("dragging");
        const itemRect = $item[0].getBoundingClientRect();

        $clone.css({
          position: "fixed",
          width: itemRect.width,
          height: itemRect.height, // 添加高度
          zIndex: 1000,
          pointerEvents: "none",
          left: itemRect.left,
          top: itemRect.top,
          opacity: 0.9, // 稍微透明以便看到下方内容
          transform: "scale(1.02)", // 轻微放大以示区分
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)", // 添加阴影
        });

        // 记录鼠标相对克隆元素的偏移
        const mouseOffsetY = e.clientY - itemRect.top;

        $("body").append($clone);
        $item.css("visibility", "hidden");

        // 创建占位元素
        const $placeholder = $("<div>")
          .addClass("highlight-item-placeholder")
          .css({
            height: itemRect.height,
            margin: $item.css("margin"),
            backgroundColor: "#f5f7fa",
            border: "2px dashed #dcdfe6",
            borderRadius: "4px",
          });

        $item.after($placeholder);

        // 处理拖动
        $(document).on("mousemove.drag", (e) => {
          if (!isDragging) return;

          // 克隆元素跟随鼠标
          const newTop = e.clientY - mouseOffsetY;
          $clone.css("top", newTop);

          // 计算目标位置
          const containerRect = container[0].getBoundingClientRect();
          const scrollTop = container.scrollTop();
          const relativeY = e.clientY - containerRect.top + scrollTop;

          // 获取所有非占位符的项目
          const $items = $(".highlight-item:not(.dragging)");

          // 找到最近的插入点
          let targetIndex = -1;
          let minDistance = Infinity;

          $items.each((i, el) => {
            const rect = el.getBoundingClientRect();
            const center = rect.top + rect.height / 2;
            const distance = Math.abs(e.clientY - center);

            if (distance < minDistance) {
              minDistance = distance;
              targetIndex = i;
            }
          });

          // 更新占位符位置
          if (targetIndex !== -1) {
            const $target = $items.eq(targetIndex);
            const isAfter =
              e.clientY >
              $target[0].getBoundingClientRect().top + $target.height() / 2;

            if (isAfter) {
              $target.after($placeholder);
            } else {
              $target.before($placeholder);
            }

            dragEndIndex = $placeholder.index();
          }

          // 优化自动滚动
          const scrollMargin = 50;
          const maxSpeed = 15;
          const containerTop = containerRect.top;
          const containerBottom = containerRect.bottom;

          if (e.clientY < containerTop + scrollMargin) {
            const speed = Math.ceil(
              ((scrollMargin - (e.clientY - containerTop)) / scrollMargin) *
                maxSpeed
            );
            container.scrollTop(container.scrollTop() - speed);
          } else if (e.clientY > containerBottom - scrollMargin) {
            const speed = Math.ceil(
              ((scrollMargin - (containerBottom - e.clientY)) / scrollMargin) *
                maxSpeed
            );
            container.scrollTop(container.scrollTop() + speed);
          }
        });

        // 处理拖动结束
        $(document).on("mouseup.drag", () => {
          if (!isDragging) return;

          isDragging = false;
          $clone.remove();
          $placeholder.replaceWith($item);
          $item.css("visibility", "");

          $(document).off(".drag");

          if (dragEndIndex !== dragStartIndex) {
            reorderCategories(dragStartIndex, dragEndIndex);
          }
        });
      });
    });
  }

  // 重新排序并保存
  async function reorderCategories(fromIndex, toIndex) {
    try {
      // 重新排序数组
      const newData = [...listData];
      const [movedItem] = newData.splice(fromIndex, 1);
      newData.splice(toIndex, 0, movedItem);

      // 更新数据
      listData = newData;

      // 保存到存储
      await chrome.runtime.sendMessage({
        opt: "rpc",
        func: "setKeywordsString2",
        args: [listData],
      });

      // 刷新高亮
      await chrome.runtime.sendMessage({
        opt: "event",
        event: "reapplyHighlights",
      });
    } catch (error) {
      console.error("保存分类顺序失败:", error);
    }
  }

  // 确保颜色选择器HTML正确添加到body
  if (!$(".colorBox").length) {
    const colorBoxHtml = `
            <div class="colorBox" style="display:none;">
                <div class="color-picker__grid">
                    ${Array.from(
                      { length: 20 },
                      (_, i) => `
                        <div class="color-picker__item chrome-extension-mutihighlight-style-${
                          i + 1
                        }" 
                             data-color-index="${i + 1}">
                        </div>
                    `
                    ).join("")}
                </div>
            </div>
        `;
    $("body").append(colorBoxHtml);
  }

  // 修改统一的确认对话框实现
  function showCustomConfirm(message, onConfirm) {
    // 确保不会重复创
    $(".custom-confirm-overlay").remove();

    const confirmHtml = `
            <div class="el-overlay" style="z-index: 2002;">
                <div class="el-dialog" style="width: 400px; z-index: 2003;">
                    <div class="el-dialog__header">
                        <h3>确认作</h3>
                    </div>
                    
                    <div class="el-dialog__body">
                        <p>${message}</p>
                    </div>
                    
                    <div class="el-dialog__footer">
                        <button class="el-button cancel">取消</button>
                        <button class="el-button el-button--primary confirm" style="margin-left: 8px;">确定</button>
                    </div>
                </div>
            </div>
        `;

    const $confirm = $(confirmHtml);
    $("body").append($confirm);

    // 添加动画效果
    $confirm.hide().fadeIn(200);

    // 点击遮罩层关闭
    $confirm.click(function (e) {
      if ($(e.target).hasClass("el-overlay")) {
        $confirm.fadeOut(200, function () {
          $confirm.remove();
        });
      }
    });

    // 取消按钮
    $confirm.find(".cancel").click(() => {
      $confirm.fadeOut(200, function () {
        $confirm.remove();
      });
    });

    // 定按钮
    $confirm.find(".confirm").click(() => {
      $confirm.fadeOut(200, function () {
        $confirm.remove();
        onConfirm();
      });
    });
  }

  // 发送消息标签页时添加更好的错误处理
  async function sendMessageToTabs(message) {
    const tabs = await chrome.tabs.query({});
    return Promise.all(
      tabs.map((tab) => {
        // 只向 http/https 页面发消息
        if (tab.url?.startsWith("http")) {
          return chrome.tabs.sendMessage(tab.id, message).catch(() => {
            // 忽略连接错误
          });
        }
        return Promise.resolve();
      })
    );
  }

  // 移除所有对 updateKeywords 的引用，确保使用 debouncedUpdateKeywords

  // 在初始化事件处理的部分添加
  $("#manage").click(function () {
    chrome.windows.create({
      url: "manage.html",
      type: "popup",
      width: 900, // 设置窗口宽度
      height: 700, // 设置窗口高度
      left: 50, // 设置窗口左边距
      top: 50, // 设置窗口上边距
    });
  });

  // 修改检更新功能
  async function checkUpdate() {
    try {
      const currentVersion = chrome.runtime.getManifest().version;

      // 添加时间戳防止缓存
      const response = await fetch(
        "https://gengxin.geluman.cn/update.json?" + Date.now(),
        {
          method: "GET",
          headers: {
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
          },
        }
      );

      if (!response.ok) {
        throw new Error("更新服务器响应异常");
      }

      const data = await response.json();

      // 版本号比较
      const cloudVersion = data.version;
      const currentParts = currentVersion.split(".").map(Number);
      const cloudParts = cloudVersion.split(".").map(Number);

      let needUpdate = false;
      for (let i = 0; i < 3; i++) {
        if (cloudParts[i] > currentParts[i]) {
          needUpdate = true;
          break;
        } else if (cloudParts[i] < currentParts[i]) {
          break;
        }
      }

      if (needUpdate) {
        showUpdateDialog({
          newVersion: data.version,
          currentVersion: currentVersion,
          updateInfo: data.updateInfo || "优化功能，修复已知问题",
          downloadUrl: data.downloadUrl,
        });
      } else {
        showToast("当前已是最新版本");
      }
    } catch (error) {
      console.error("检查更新失败:", error);
      showToast("检查更新失败，请稍后重试", "error");
    }
  }

  // 修改显示更新对话框函数
  function showUpdateDialog(updateData) {
    const $dialog = $("#updateDialog");
    const $overlay = $("#overlay");

    // 更新内容
    $("#updateContent").html(`
            <div class="version">发现新版本: ${updateData.newVersion}</div>
            <div class="update-info">
                <div>当前版本: ${updateData.currentVersion}</div>
                <div style="margin-top:8px">更新内容:</div>
                <div style="color:#666;margin-top:4px">${updateData.updateInfo}</div>
            </div>
            <div class="update-guide">
                <div>更新步骤:</div>
                <ol>
                    <li>点击"下载更新"下载新版本</li>
                    <li>解压下载的zip文件</li>
                    <li>打开Chrome扩展程序页面 (chrome://extensions/)</li>
                    <li>开启"开发者模式"</li>
                    <li>点击"加载已解压的扩展程序"</li>
                    <li>选择解压后的文件夹，即可完成更新</li>
                </ol>
            </div>
        `);

    // 显示下载按钮和对话框
    $("#downloadUpdate").show();
    $dialog.fadeIn(200);
    $overlay.fadeIn(200);

    // 下载按钮事件
    $("#downloadUpdate")
      .off("click")
      .on("click", function () {
        if (updateData.downloadUrl) {
          window.open(updateData.downloadUrl, "_blank");
          $dialog.fadeOut(200);
          $overlay.fadeOut(200);
        }
      });
  }

  // 绑定事件处理
  $(document).ready(() => {
    // 确保 DOM 完全加载后再初始化
    initialize().catch((error) => {
      console.error("初始化加载失败:", error);
    });

    // 检查更新按钮点击事件
    $("#checkUpdate").click(() => {
      checkUpdate();
    });

    // 关闭更新对话框
    $("#closeUpdateDialog").click(() => {
      $("#updateDialog, #overlay").fadeOut(200);
    });

    // 点击遮罩层关闭对话框
    $("#overlay").click(() => {
      $("#updateDialog, #overlay").fadeOut(200);
    });
  });

  async function backupBeforeUpdate() {
    try {
      const data = {
        version: chrome.runtime.getManifest().version,
        timestamp: Date.now(),
        keywords: await chrome.runtime.sendMessage({
          opt: "rpc",
          func: "getKeywordsString2",
        }),
      };

      // 保存到 storage
      await chrome.storage.local.set({ updateBackup: data });
    } catch (error) {
      console.error("更新备份失败:", error);
    }
  }

  // 修改 saveAndNotify 函数
  async function saveAndNotify() {
    try {
      // 获取当前标签页
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (tab) {
        // 更新存储
        await chrome.runtime.sendMessage({
          opt: "rpc",
          func: "setKeywordsString2",
          args: [listData],
        });

        // 获取新的关键词数组
        const keywords = await chrome.runtime.sendMessage({
          opt: "rpc",
          func: "getKeywords",
        });

        // 只通知当前标签页更新
        await chrome.tabs
          .sendMessage(tab.id, {
            opt: "event",
            event: "storageChange",
            args: {
              key: "fwm_keywordsArray",
              value: keywords,
            },
          })
          .catch(() => {});
      }
    } catch (error) {
      console.error("Error in saveAndNotify:", error);
    }
  }

  // 使用说明按钮点击事件
  $("#showHelp").click(() => {
    chrome.windows.create({
      url: "help.html",
      type: "popup",
      width: 830,
      height: 700,
    });
  });
});
