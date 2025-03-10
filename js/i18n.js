// 简化版本的国际化实现
(function() {
  // 获取浏览器语言
  let currentLang = navigator.language.startsWith('zh') ? 'zh_CN' : 'en';
  
  // 应用翻译
  function applyTranslations(lang) {
    console.log(`应用语言: ${lang}`);
    
    // 获取所有标记的元素
    document.querySelectorAll('[data-i18n]').forEach(element => {
      const key = element.getAttribute('data-i18n');
      const args = element.getAttribute('data-i18n-args');
      
      // 获取翻译文本
      let translatedText;
      if (lang === 'en') {
        translatedText = getEnglishText(key, args);
      } else {
        translatedText = getChineseText(key, args);
      }
      
      // 应用翻译
      if (element.tagName === 'BUTTON') {
        // 按钮特殊处理 - 只替换最后一个文本节点，保留SVG
        const childNodes = Array.from(element.childNodes);
        
        // 查找所有文本节点
        const textNodes = childNodes.filter(node => 
          node.nodeType === Node.TEXT_NODE && node.textContent.trim()
        );
        
        // 如果有文本节点，替换最后一个（通常是按钮文字）
        if (textNodes.length > 0) {
          const lastTextNode = textNodes[textNodes.length - 1];
          lastTextNode.textContent = translatedText;
        } else {
          // 如果没有找到文本节点，添加一个到末尾
          element.appendChild(document.createTextNode(translatedText));
        }
      } else {
        element.textContent = translatedText;
      }
    });
    
    // 处理placeholder属性
    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
      const key = element.getAttribute('data-i18n-placeholder');
      const translated = lang === 'en' ? getEnglishText(key) : getChineseText(key);
      if (translated) {
        element.placeholder = translated;
      }
    });
  }
  
  // 更新切换按钮的文本
  function updateToggleButtonText(lang) {
    const toggleBtn = document.getElementById('toggleLanguage');
    if (toggleBtn) {
      toggleBtn.textContent = lang === 'en' ? '中文' : 'English';
    }
  }
  
  // 英文翻译 - 添加更多动态内容需要的翻译
  function getEnglishText(key, args) {
    const translations = {
      'create': 'New',
      'manage': 'Manage',
      'deduplicate': 'Dedup',
      'share': 'Share',
      'export': 'Export',
      'import': 'Import',
      'version': args ? `Ver: ${args}` : 'Ver',
      'keywordCount': args ? `Words: ${args}` : 'Words',
      'checkUpdate': 'Update',
      'helpText': 'Help',
      'updateDialogTitle': 'Check Update',
      'close': 'Close',
      'downloadUpdate': 'Download',
      
      // manage.html 翻译
      'manageTitle': 'Manage Highlights',
      'manageHighlights': 'Manage Highlight Categories',
      'addCategory': 'Add Category',
      'backToPopup': 'Back',
      'color': 'Color',
      'categoryName': 'Category Name',
      'keywords': 'Keywords',
      'actions': 'Actions',
      'editCategory': 'Edit Category',
      'keywordsTip': 'Separate multiple keywords with spaces',
      'save': 'Save',
      'cancel': 'Cancel',
      'delete': 'Delete',
      
      // help.html 翻译
      'helpTitle': 'User Guide',
      'helpGuide': 'User Guide',
      'basicUsage': 'Basic Usage',
      'basicUsageDesc': 'This extension helps you highlight important text on webpages with multiple colors and categories.',
      'createHighlight': 'Create Highlight',
      'createHighlightDesc': 'Click the extension icon, click "New" button in the popup, enter category name and keywords, select a color and save.',
      'manageHighlight': 'Manage Highlights',
      'manageHighlightDesc': 'Click "Manage" button to enter management page where you can edit, delete or add highlight categories.',
      'quickHighlight': 'Quick Highlight',
      'quickHighlightDesc': 'Select text on webpage, press Alt+Shift+C (Windows) or MacCtrl+Shift+C (Mac), then choose a category to add the text to highlight list.',
      'advancedFeatures': 'Advanced Features',
      'exportImport': 'Export & Import',
      'exportImportDesc': 'Use "Export" and "Import" buttons to backup and restore your highlight configurations.',
      'shareConfig': 'Share Configuration',
      'shareConfigDesc': 'Click "Share" button to generate a share code that other users can import to use your highlight configuration.',
      'keyboardShortcuts': 'Keyboard Shortcuts',
      'shortcutAdd': 'Alt+Shift+C (Windows) / MacCtrl+Shift+C (Mac): Add selected text to highlight category',
      'shortcutRemove': 'Alt+Shift+D (Windows) / MacCtrl+Shift+D (Mac): Remove highlight from selected text',
      
      // dialog.html 翻译
      'dialogTitle': 'Highlight Settings',
      'highlightSettings': 'Highlight Settings',
      'selectHighlightType': 'Select Highlight Type',
      'typeKeyword': 'Keyword Highlight',
      'typeSelection': 'Selection Highlight',
      'enterKeywords': 'Enter Keywords',
      'highlightColor': 'Highlight Color',
      'apply': 'Apply',
      
      // 动态内容翻译
      'keywordsCount': 'keywords',
      'noCategories': 'No categories yet. Please return to main page to create.',
      'confirm': 'Confirm',
      'successDedupe': 'Successfully deduplicated keywords',
      'errorDedupe': 'Failed to deduplicate, please try again',
      'shareCodeDesc': 'Copy the share code below. Other users can import your configuration.',
      'copy': 'Copy',
      'totalCount': 'Total Keywords',
      'categoryCount': 'Categories',
      
      // 新增动态内容翻译
      'deleteCategory': 'Delete Category',
      'systemLibrary': 'System Library',
      'noKeywords': 'No keywords yet',
      'noMatchingKeywords': 'No matching keywords',
      'keywordDeleteSuccess': 'Keyword deleted successfully',
      'categoryDeleteSuccess': 'Category deleted successfully',
      'deleteError': 'Delete failed, please try again',
      'initError': 'Initialization failed, please refresh',
      'confirmAction': 'Confirm Action',
      'noDuplicatesFound': 'No duplicate keywords found',
      'exportError': 'Export failed, please try again',
      'copySuccess': 'Copied successfully',
      'importConfirmMessage': 'Are you sure you want to import this configuration? This will overwrite all current settings.',
      'importParseError': 'Failed to parse import file',
      'searchKeywords': 'Search keywords...',
      
      // help.html中需要的翻译
      'basicFeatures': 'Basic Features',
      'createCategory': 'Create Category: Click the "Create" button to add a new highlight category',
      'editCategory': 'Edit Category: Modify category name and highlight keywords',
      'deleteCategory': 'Delete Category: Click the delete button in the top right corner of the category',
      'toggleCategory': 'Toggle Category: Use the switch in the top right corner to enable or disable the category',
      'changeColor': 'Change Color: Click the color block to change the highlight color',
      'dragSort': 'Drag to Sort: Hold the category border to drag and adjust the category order',
      
      // help.html中的快捷键操作
      'shortcutOperations': 'Keyboard Shortcuts',
      'shortcutAddHighlight': 'Add Highlight: Select text and press Alt + Shift + C (Mac ^ + ⇧ + C)',
      'shortcutRemoveHighlight': 'Remove Highlight: Select text and press Alt + Shift + D (Mac ^ + ⇧ + D)',
      'shortcutNote': 'To modify shortcuts, go to browser extension management (chrome://extensions/shortcuts)',
      
      // help.html中的右键菜单
      'rightClickMenu': 'Right-Click Menu',
      'rightClickAddHighlight': 'Add Highlight: Select text, right-click and choose "Add to highlight category", then select a category',
      'rightClickRemoveHighlight': 'Remove Highlight: Select highlighted text, right-click and choose "Remove highlight"',
      
      // help.html中的分类管理
      'categoryManagement': 'Category Management',
      'editCategoryName': 'Edit Category Name: Click on the category name in the management interface',
      'deleteCategoryItem': 'Delete Category: Click the delete button on the right side of the category',
      'editKeywords': 'Edit Keywords: Edit keywords directly in the category text box, separate multiple keywords with spaces',
      'changeColorItem': 'Change Color: Click the color block to open the color picker and select a new highlight color',
      
      // 右键菜单和弹窗
      'selectCategory': 'Select Category',
      'addToCategory': 'Add to Highlight Category',
      'removeHighlight': 'Remove Highlight',
      'addHighlightSuccess': 'Added to highlight successfully',
      'removeHighlightSuccess': 'Removed highlight successfully',
      
      // 添加placeholder翻译
      'enterCategoryName': 'Enter category name',
      'enterKeywords': 'Enter keywords, separate with spaces',
      
      // 分享对话框
      'shareCode': 'Share Code',
      'importShareCode': 'Import Share Code',
      'enterShareCode': 'Enter share code',
      
      // 更新对话框
      'newVersionFound': args ? `New version found: ${args}` : 'New version found',
      'currentVersionLabel': args ? `Current version: ${args}` : 'Current version',
      'updateInfoLabel': 'Update content:',
      'updateSteps': 'Update steps:',
      'updateStep1': '1. Click "Download Update" to download the new version',
      'updateStep2': '2. Extract the downloaded zip file',
      'updateStep3': '3. Open Chrome extensions page (chrome://extensions/)',
      'updateStep4': '4. Enable "Developer mode"',
      'updateStep5': '5. Click "Load unpacked extension"',
      'updateStep6': '6. Select the extracted folder to complete the update',
      'shareError': 'Share failed, please try again'
    };
    
    return translations[key] || key;
  }
  
  // 中文翻译 - 添加更多动态内容需要的翻译
  function getChineseText(key, args) {
    const translations = {
      'create': '创建',
      'manage': '管理',
      'deduplicate': '去重',
      'share': '分享',
      'export': '导出',
      'import': '导入',
      'version': args ? `版本: ${args}` : '版本',
      'keywordCount': args ? `词数: ${args}` : '词数',
      'checkUpdate': '检查更新',
      'helpText': '使用说明',
      'updateDialogTitle': '检查更新',
      'close': '关闭',
      'downloadUpdate': '下载更新',
      
      // manage.html 翻译
      'manageTitle': '管理高亮分类',
      'manageHighlights': '管理高亮分类',
      'addCategory': '添加分类',
      'backToPopup': '返回',
      'color': '颜色',
      'categoryName': '分类名称',
      'keywords': '关键词',
      'actions': '操作',
      'editCategory': '编辑分类',
      'keywordsTip': '多个关键词请用空格分隔',
      'save': '保存',
      'cancel': '取消',
      'delete': '删除',
      
      // help.html 翻译
      'helpTitle': '使用说明',
      'helpGuide': '使用指南',
      'basicUsage': '基本使用',
      'basicUsageDesc': '本插件可以帮助您在网页上高亮显示重要文本，支持多种颜色和分类管理。',
      'createHighlight': '创建高亮',
      'createHighlightDesc': '点击插件图标，在弹出窗口中点击"创建"按钮，输入分类名称和关键词，选择颜色后保存。',
      'manageHighlight': '管理高亮',
      'manageHighlightDesc': '点击"管理"按钮进入管理页面，可以编辑、删除或添加高亮分类。',
      'quickHighlight': '快速高亮',
      'quickHighlightDesc': '在网页上选中文本，按下Alt+Shift+C(Windows)或MacCtrl+Shift+C(Mac)，选择分类将文本添加到高亮列表。',
      'advancedFeatures': '高级功能',
      'exportImport': '导出与导入',
      'exportImportDesc': '使用"导出"和"导入"按钮可以备份和恢复您的高亮配置。',
      'shareConfig': '分享配置',
      'shareConfigDesc': '点击"分享"按钮可以生成分享码，其他用户可以通过分享码导入您的高亮配置。',
      'keyboardShortcuts': '键盘快捷键',
      'shortcutAdd': 'Alt+Shift+C (Windows) / MacCtrl+Shift+C (Mac): 添加选中文本到高亮分类',
      'shortcutRemove': 'Alt+Shift+D (Windows) / MacCtrl+Shift+D (Mac): 移除选中文本的高亮',
      
      // dialog.html 翻译
      'dialogTitle': '高亮设置',
      'highlightSettings': '高亮设置',
      'selectHighlightType': '选择高亮类型',
      'typeKeyword': '关键词高亮',
      'typeSelection': '选中文本高亮',
      'enterKeywords': '输入关键词',
      'highlightColor': '高亮颜色',
      'apply': '应用',
      
      // 动态内容翻译
      'keywordsCount': '个关键词',
      'noCategories': '暂无分类，请返回主界面创建',
      'confirm': '确定',
      'successDedupe': '关键词去重成功',
      'errorDedupe': '去重失败，请重试',
      'shareCodeDesc': '复制以下分享码，其他用户可通过导入功能使用您的配置',
      'copy': '复制',
      'totalCount': '总词数',
      'categoryCount': '分类数',
      
      // 新增动态内容翻译
      'deleteCategory': '删除分类',
      'systemLibrary': '系统词库',
      'noKeywords': '暂无关键词',
      'noMatchingKeywords': '没有匹配的关键词',
      'keywordDeleteSuccess': '关键词删除成功',
      'categoryDeleteSuccess': '分类删除成功',
      'deleteError': '删除失败，请重试',
      'initError': '初始化失败，请刷新重试',
      'confirmAction': '确认操作',
      'noDuplicatesFound': '没有发现重复词',
      'exportError': '导出失败请重试',
      'copySuccess': '复制成功',
      'importConfirmMessage': '确定要导入配置吗？这将覆盖当前的所有配置。',
      'importParseError': '导入文件解析失败',
      'searchKeywords': '搜索关键词...',
      
      // help.html中需要的翻译
      'basicFeatures': '基本功能',
      'createCategory': '创建分类: 点击"创建"按钮添加新的高亮分类',
      'editCategory': '编辑分类: 可以修改分类名称和高亮关键词',
      'deleteCategory': '删除分类: 点击分类右上角的删除按钮',
      'toggleCategory': '开关分类: 使用分类右上角的开关控制该分类是否生效',
      'changeColor': '修改颜色: 点击色块可以更换该分类的高亮颜色',
      'dragSort': '拖拽排序: 按住分类边框可以拖动调整分类顺序',
      
      // help.html中的快捷键操作
      'shortcutOperations': '快捷键操作',
      'shortcutAddHighlight': '添加高亮: 选中文本后按 Alt + Shift + C (Mac ^ + ⇧ + C)',
      'shortcutRemoveHighlight': '删除高亮: 选中文本后按 Alt + Shift + D (Mac ^ + ⇧ + D)',
      'shortcutNote': '如需修改快捷键，请在浏览器的扩展管理中心 (chrome://extensions/shortcuts) 进行设置',
      
      // help.html中的右键菜单
      'rightClickMenu': '右键菜单',
      'rightClickAddHighlight': '添加高亮: 选中文本后右键选择"添加到高亮分类"，在弹出的分类列表中选择目标分类',
      'rightClickRemoveHighlight': '删除高亮: 选中已高亮的文本后右键选择"删除高亮"，即可移除该关键词的高亮效果',
      
      // help.html中的分类管理
      'categoryManagement': '分类管理',
      'editCategoryName': '编辑分类名称: 在管理界面点击分类名称即可修改',
      'deleteCategoryItem': '删除分类: 点击分类右侧的删除按钮可以删除整个分类',
      'editKeywords': '编辑关键词: 在分类的文本框中直接编辑关键词，多个关键词用空格分隔',
      'changeColorItem': '修改颜色: 点击颜色块可以打开颜色选择器，选择新的高亮颜色',
      
      // 右键菜单和弹窗
      'selectCategory': '选择分类',
      'addToCategory': '添加到高亮分类',
      'removeHighlight': '删除高亮',
      'addHighlightSuccess': '添加高亮成功',
      'removeHighlightSuccess': '删除高亮成功',
      
      // 添加placeholder翻译
      'enterCategoryName': '请输入名称',
      'enterKeywords': '请输入高亮词，多个以空格隔开',
      
      // 分享对话框
      'shareCode': '分享码',
      'importShareCode': '导入分享码',
      'enterShareCode': '请输入分享码',
      
      // 更新对话框
      'newVersionFound': args ? `发现新版本: ${args}` : '发现新版本',
      'currentVersionLabel': args ? `当前版本: ${args}` : '当前版本',
      'updateInfoLabel': '更新内容:',
      'updateSteps': '更新步骤:',
      'updateStep1': '1. 点击"下载更新"下载新版本',
      'updateStep2': '2. 解压下载的zip文件',
      'updateStep3': '3. 打开Chrome扩展程序页面 (chrome://extensions/)',
      'updateStep4': '4. 开启"开发者模式"',
      'updateStep5': '5. 点击"加载已解压的扩展程序"',
      'updateStep6': '6. 选择解压后的文件夹，即可完成更新',
      'shareError': '分享失败，请重试'
    };
    
    return translations[key] || key;
  }
  
  // 初始化时直接使用浏览器语言
  function initialize() {
    applyTranslations(currentLang);
  }
  
  // DOM加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
  
  // 全局对象
  window.i18n = {
    getMessage: function(key, fallback) {
      const translated = currentLang === 'en' ? 
        getEnglishText(key) : 
        getChineseText(key);
      return translated || fallback || key;
    },
    getCurrentLanguage: function() {
      return currentLang;
    }
  };
})(); 