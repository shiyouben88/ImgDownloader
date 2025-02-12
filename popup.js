// 导入国际化工具函数
import { t } from './i18n.js';

// 全局状态管理
let downloadQueue = [];
let selectedImages = new Set();

// 添加一个全局变量来跟踪加载状态
let isLoadingImages = false;
let loadedImages = null;

// 默认设置
const DEFAULT_SETTINGS = {
  minWidth: 0,
  minHeight: 0
};

let currentSettings = {...DEFAULT_SETTINGS};

/**
 * 获取图片大小
 * @param {string} url - 图片URL
 * @returns {Promise<string>} 返回图片大小（KB）
 */
async function getImageSize(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Referrer-Policy': 'no-referrer'
      },
      mode: 'cors',
      referrerPolicy: 'no-referrer'
    });
    const blob = await response.blob();
    return (blob.size / 1024).toFixed(2) + ' KB';
  } catch (error) {
    console.error('Error getting image size:', error);
    return 'Unknown';
  }
}

/**
 * 显示图片列表
 * 获取页面上的所有图片，并按照大小和分辨率排序显示
 */
async function displayImages() {
  const loadingElement = document.getElementById('loading');
  
  // 如果已经加载过图片，直接显示
  if (loadedImages) {
    renderImages(loadedImages);
    return;
  }

  loadingElement.style.display = 'flex';

  // 如果已经在加载中，不要重复加载
  if (isLoadingImages) {
    return;
  }

  isLoadingImages = true;
  const imageList = document.getElementById('imageList');
  imageList.innerHTML = '';  // 清空列表，准备渐进式加载

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    chrome.tabs.sendMessage(tab.id, { action: 'getImages' }, async response => {
      // 创建一个队列来存储待处理的图片
      const processingQueue = [...response.images];
      const processedImages = [];
      
      // 每次处理一批图片
      const batchSize = 5;  // 每批处理5张图片
      
      while (processingQueue.length > 0) {
        const batch = processingQueue.splice(0, batchSize);
        
        // 处理这一批图片
        const processedBatch = await Promise.all(
          batch.map(async img => {
            const size = await getImageSize(img.src);
            return { ...img, sizeKB: parseFloat(size) };
          })
        );
        
        // 将处理好的图片添加到结果数组
        processedImages.push(...processedBatch);
        
        // 对当前所有处理好的图片进行排序
        const sortedImages = processedImages.sort((a, b) => {
          const [aLong, aShort] = a.width >= a.height ? [a.width, a.height] : [a.height, a.width];
          const [bLong, bShort] = b.width >= b.height ? [b.width, b.height] : [b.height, b.width];
          
          if (aLong !== bLong) return bLong - aLong;
          if (aShort !== bShort) return bShort - aShort;
          
          return b.sizeKB - a.sizeKB;
        });
        
        // 过滤并立即渲染当前批次
        const filteredImages = filterImages(sortedImages);
        renderImages(filteredImages);
        
        // 给用户界面一个更新的机会
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      // 所有图片处理完成后，保存过滤后的结果
      const finalSortedImages = processedImages.sort((a, b) => {
        const [aLong, aShort] = a.width >= a.height ? [a.width, a.height] : [a.height, a.width];
        const [bLong, bShort] = b.width >= b.height ? [b.width, b.height] : [b.height, b.width];
        
        if (aLong !== bLong) return bLong - aLong;
        if (aShort !== bShort) return bShort - aShort;
        
        return b.sizeKB - a.sizeKB;
      });
      
      // 保存过滤后的结果
      loadedImages = filterImages(finalSortedImages);
      isLoadingImages = false;
      loadingElement.style.display = 'none';
    });
  } catch (error) {
    console.error('Error:', error);
    isLoadingImages = false;
    loadingElement.style.display = 'none';
  }
}

/**
 * 渲染图片列表
 * @param {Array} images - 要显示的图片数组
 */
function renderImages(images) {
  const imageList = document.getElementById('imageList');
  imageList.innerHTML = '';  // 清空现有内容
  
  for (const img of images) {
    const card = document.createElement('div');
    card.className = 'image-card';
    
    // 创建复选框
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'image-checkbox';
    checkbox.dataset.url = img.src;
    
    // 添加卡片点击事件
    card.addEventListener('click', (e) => {
      if (e.target.classList.contains('download-btn')) return;
      
      const isSelected = !checkbox.checked;
      checkbox.checked = isSelected;
      
      if (isSelected) {
        selectedImages.add(img.src);
        card.classList.add('selected');
      } else {
        selectedImages.delete(img.src);
        card.classList.remove('selected');
      }
      
      requestAnimationFrame(() => {
        updateDownloadSelectedButton();
      });
    });
    
    // 添加复选框点击事件
    checkbox.addEventListener('click', (e) => {
      e.stopPropagation();
      const isSelected = checkbox.checked;
      
      if (isSelected) {
        selectedImages.add(img.src);
        card.classList.add('selected');
      } else {
        selectedImages.delete(img.src);
        card.classList.remove('selected');
      }
      
      requestAnimationFrame(() => {
        updateDownloadSelectedButton();
      });
    });
    
    // 创建图片容器
    const imageContainer = document.createElement('div');
    imageContainer.className = 'image-container';
    
    // 创建图片预览
    const imgElement = document.createElement('img');
    imgElement.alt = 'Preview';
    imgElement.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiBmaWxsPSIjZjVmNWY1Ii8+PHRleHQgeD0iMTIiIHk9IjEyIiBmb250LXNpemU9IjEyIiBmaWxsPSIjOTk5IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+TG9hZGluZy4uLjwvdGV4dD48L3N2Zz4=';
    
    const actualImage = new Image();
    actualImage.crossOrigin = 'anonymous';
    actualImage.referrerPolicy = 'no-referrer';

    // 处理Instagram图片加载
    if (img.src.includes('instagram.com')) {
      loadImageWithFetch(img.src).then(blobUrl => {
        if (blobUrl) {
          imgElement.src = blobUrl;
          imgElement.onload = () => {
            URL.revokeObjectURL(blobUrl);
          };
        } else {
          imgElement.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiBmaWxsPSIjZjVmNWY1Ii8+PHRleHQgeD0iMTIiIHk9IjEyIiBmb250LXNpemU9IjEyIiBmaWxsPSIjOTk5IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+RmFpbGVkPC90ZXh0Pjwvc3ZnPg==';
        }
      });
    } else {
      actualImage.onload = () => {
        imgElement.src = actualImage.src;
      };
      actualImage.onerror = () => {
        imgElement.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiBmaWxsPSIjZjVmNWY1Ii8+PHRleHQgeD0iMTIiIHk9IjEyIiBmb250LXNpemU9IjEyIiBmaWxsPSIjOTk5IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+RmFpbGVkPC90ZXh0Pjwvc3ZnPg==';
      };
      actualImage.src = img.src;
    }
    
    imageContainer.appendChild(imgElement);
    
    // 添加图片信息和下载按钮
    const infoHtml = `
      <div class="image-info">
        <div>${t('size')}: ${img.width} x ${img.height}</div>
        <div>${t('fileSize')}: ${img.sizeKB.toFixed(2)} KB</div>
      </div>
    `;
    
    card.appendChild(checkbox);
    card.appendChild(imageContainer);
    card.insertAdjacentHTML('beforeend', infoHtml);
    
    // 直接在这里设置下载按钮的事件监听
    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'download-btn';
    downloadBtn.textContent = t('download');
    downloadBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // 防止触发卡片的点击事件
      downloadImage(img.src);
    });
    
    card.appendChild(downloadBtn);
    imageList.appendChild(card);
  }
  
  downloadQueue = images.map(img => img.src);
  
  // 重新添加全局下载按钮的事件监听
  document.getElementById('downloadAll').addEventListener('click', downloadAll);
  document.getElementById('downloadSelected').addEventListener('click', downloadSelected);
}

/**
 * 设置事件监听器
 * 为下载按钮添加点击事件
 */
function setupEventListeners() {
  document.getElementById('downloadAll').addEventListener('click', downloadAll);
  document.getElementById('downloadSelected').addEventListener('click', downloadSelected);
}

/**
 * 下载所有图片
 */
async function downloadAll() {
  const downloads = downloadQueue.map(url => ({
    url,
    pageTitle: currentPageTitle
  }));
  
  chrome.runtime.sendMessage({
    action: 'queueDownloads',
    urls: downloads
  });
}

/**
 * 下载选中的图片
 */
async function downloadSelected() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const pageTitle = tab.title.replace(/[<>:"/\\|?*]/g, '_');
  
  const downloads = Array.from(selectedImages).map(url => ({
    url,
    pageTitle
  }));
  
  chrome.runtime.sendMessage({
    action: 'queueDownloads',
    urls: downloads
  });
  
  selectedImages.clear();
  document.querySelectorAll('.image-checkbox').forEach(checkbox => {
    checkbox.checked = false;
  });
  updateDownloadSelectedButton();
}

/**
 * 下载单张图片
 * @param {string} url - 图片URL
 */
let currentPageTitle = '';

document.addEventListener('DOMContentLoaded', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentPageTitle = tab.title.replace(/[<>:"\\|?*]/g, '_');
  
  // 如果已经有加载好的图片，直接显示
  if (loadedImages) {
    renderImages(loadedImages);
  } else {
    displayImages();
  }
});

async function downloadImage(url) {
  console.log('单个下载 - 页面标题:', currentPageTitle);
  
  chrome.runtime.sendMessage({
    action: 'queueDownloads',
    urls: [{
      url,
      pageTitle: currentPageTitle
    }]
  });
}

/**
 * 更新下载选中按钮状态
 */
function updateDownloadSelectedButton() {
  const downloadSelectedBtn = document.getElementById('downloadSelected');
  downloadSelectedBtn.disabled = selectedImages.size === 0;
}

/**
 * 加载设置
 */
async function loadSettings() {
  try {
    const result = await chrome.storage.sync.get('settings');
    currentSettings = result.settings || {...DEFAULT_SETTINGS};
    
    if (!currentSettings.minWidth) currentSettings.minWidth = DEFAULT_SETTINGS.minWidth;
    if (!currentSettings.minHeight) currentSettings.minHeight = DEFAULT_SETTINGS.minHeight;
    
    document.getElementById('minWidth').value = currentSettings.minWidth;
    document.getElementById('minHeight').value = currentSettings.minHeight;
  } catch (error) {
    console.error('Error loading settings:', error);
    currentSettings = {...DEFAULT_SETTINGS};
  }
}

/**
 * 保存设置
 */
async function saveSettings() {
  const minWidthInput = document.getElementById('minWidth');
  const minHeightInput = document.getElementById('minHeight');
  
  if (minWidthInput.value.trim() === '') {
    minWidthInput.value = '0';
  }
  if (minHeightInput.value.trim() === '') {
    minHeightInput.value = '0';
  }
  
  const minWidth = parseInt(minWidthInput.value);
  const minHeight = parseInt(minHeightInput.value);
  
  if (isNaN(minWidth) || isNaN(minHeight) || minWidth < 0 || minHeight < 0) {
    alert(t('invalidSize'));
    return;
  }
  
  currentSettings = {
    minWidth,
    minHeight
  };
  
  try {
    await chrome.storage.sync.set({ settings: currentSettings });
    document.getElementById('settingsModal').style.display = 'none';
    await displayImages();
  } catch (error) {
    console.error('Error saving settings:', error);
    alert('保存设置失败，请重试');
  }
}

/**
 * 设置相关事件监听器
 */
function setupSettingsListeners() {
  const modal = document.getElementById('settingsModal');
  const settingsBtn = document.getElementById('settingsBtn');
  const closeBtn = document.getElementById('closeSettings');
  const saveBtn = document.getElementById('saveSettings');
  const minWidthInput = document.getElementById('minWidth');
  const minHeightInput = document.getElementById('minHeight');

  // 处理输入框失焦事件
  minWidthInput.addEventListener('blur', () => {
    if (minWidthInput.value.trim() === '') {
      minWidthInput.value = '0';
    }
  });

  minHeightInput.addEventListener('blur', () => {
    if (minHeightInput.value.trim() === '') {
      minHeightInput.value = '0';
    }
  });

  settingsBtn.addEventListener('click', () => {
    modal.style.display = 'block';
  });

  closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
  });

  saveBtn.addEventListener('click', saveSettings);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  });
}

/**
 * 过滤图片列表
 * 根据当前设置的最小宽度和高度过滤图片
 * @param {Array} images - 图片列表
 * @returns {Array} 过滤后的图片列表
 */
function filterImages(images) {
  return images.filter(img => 
    img.width >= currentSettings.minWidth && 
    img.height >= currentSettings.minHeight
  );
}

/**
 * 初始化国际化
 * 遍历所有带有 data-i18n 属性的元素，设置其文本内容
 */
function initializeI18n() {
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const key = element.getAttribute('data-i18n');
    element.textContent = t(key);
  });
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', async () => {
  initializeI18n();
  await loadSettings();
  setupSettingsListeners();
  displayImages();
});

/**
 * 通过 fetch 加载图片
 * @param {string} url - 图片URL
 * @returns {Promise<string|null>} 返回 blob URL 或 null
 */
async function loadImageWithFetch(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'Access-Control-Allow-Origin': '*'
      },
      mode: 'cors',
      referrerPolicy: 'no-referrer'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error('Error loading image:', error);
    return null;
  }
}

// 添加标签页变化监听
chrome.tabs.onActivated.addListener(() => {
  // 清除已加载的图片数据，因为切换了标签页
  loadedImages = null;
  isLoadingImages = false;
});

// 添加页面刷新监听
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'complete') {
    // 页面刷新后清除缓存的图片数据
    loadedImages = null;
    isLoadingImages = false;
  }
});