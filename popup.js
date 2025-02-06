import { t } from './i18n.js';

let downloadQueue = [];
let selectedImages = new Set();

const DEFAULT_SETTINGS = {
  minWidth: 0,
  minHeight: 0
};

let currentSettings = {...DEFAULT_SETTINGS};

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

async function displayImages() {
  const loadingElement = document.getElementById('loading');
  loadingElement.style.display = 'flex';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    chrome.tabs.sendMessage(tab.id, { action: 'getImages' }, async response => {
      const imageList = document.getElementById('imageList');
      imageList.innerHTML = '';
      
      const imagesWithSize = await Promise.all(
        response.images.map(async img => {
          const size = await getImageSize(img.src);
          return { ...img, sizeKB: parseFloat(size) };
        })
      );

      const filteredImages = filterImages(imagesWithSize);
      const sortedImages = filteredImages.sort((a, b) => {
        const [aLong, aShort] = a.width >= a.height ? [a.width, a.height] : [a.height, a.width];
        const [bLong, bShort] = b.width >= b.height ? [b.width, b.height] : [b.height, b.width];
        
        if (aLong !== bLong) return bLong - aLong;
        if (aShort !== bShort) return bShort - aShort;
        
        return b.sizeKB - a.sizeKB;
      });
      
      for (const img of sortedImages) {
        const card = document.createElement('div');
        card.className = 'image-card';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'image-checkbox';
        checkbox.dataset.url = img.src;
        
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
        
        const imageContainer = document.createElement('div');
        imageContainer.className = 'image-container';
        
        const imgElement = document.createElement('img');
        imgElement.alt = 'Preview';
        imgElement.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiBmaWxsPSIjZjVmNWY1Ii8+PHRleHQgeD0iMTIiIHk9IjEyIiBmb250LXNpemU9IjEyIiBmaWxsPSIjOTk5IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+TG9hZGluZy4uLjwvdGV4dD48L3N2Zz4=';
        
        const actualImage = new Image();
        actualImage.crossOrigin = 'anonymous';
        actualImage.referrerPolicy = 'no-referrer';

        async function loadImageWithFetch(url) {
          try {
            const response = await fetch(url, {
              headers: {
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'Referrer-Policy': 'no-referrer',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
              },
              credentials: 'omit',
              mode: 'cors',
              referrerPolicy: 'no-referrer'
            });
            
            const blob = await response.blob();
            return URL.createObjectURL(blob);
          } catch (error) {
            console.error('Error loading image:', error);
            return null;
          }
        }

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
        
        const extension = img.src.split('.').pop().split('?')[0].toLowerCase();
        const infoHtml = `
          <div class="image-info">
            <div>${t('size')}: ${img.width} x ${img.height}</div>
            <div>${t('fileSize')}: ${img.sizeKB.toFixed(2)} KB</div>
          </div>
          <button class="download-btn" data-url="${img.src}">${t('download')}</button>
        `;
        
        card.appendChild(checkbox);
        card.appendChild(imageContainer);
        card.insertAdjacentHTML('beforeend', infoHtml);
        imageList.appendChild(card);
      }
      
      downloadQueue = sortedImages.map(img => img.src);
      loadingElement.style.display = 'none';
      setupEventListeners();
    });
  } catch (error) {
    console.error('Error:', error);
    loadingElement.style.display = 'none';
  }
}

function setupEventListeners() {
  document.querySelectorAll('.download-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      downloadImage(btn.dataset.url);
    });
  });
  
  document.getElementById('downloadAll').addEventListener('click', downloadAll);
  document.getElementById('downloadSelected').addEventListener('click', downloadSelected);
}

async function downloadAll() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const pageTitle = tab.title.replace(/[<>:"/\\|?*]/g, '_');
  
  const downloads = downloadQueue.map(url => ({
    url,
    pageTitle
  }));
  
  chrome.runtime.sendMessage({
    action: 'queueDownloads',
    urls: downloads
  });
}

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

async function downloadImage(url) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const pageTitle = tab.title.replace(/[<>:"/\\|?*]/g, '_');
  
  chrome.runtime.sendMessage({
    action: 'queueDownloads',
    urls: [{
      url,
      pageTitle
    }]
  });
}

function updateDownloadSelectedButton() {
  const downloadSelectedBtn = document.getElementById('downloadSelected');
  downloadSelectedBtn.disabled = selectedImages.size === 0;
}

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

function setupSettingsListeners() {
  const modal = document.getElementById('settingsModal');
  const settingsBtn = document.getElementById('settingsBtn');
  const closeBtn = document.getElementById('closeSettings');
  const saveBtn = document.getElementById('saveSettings');
  const minWidthInput = document.getElementById('minWidth');
  const minHeightInput = document.getElementById('minHeight');

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

function filterImages(images) {
  return images.filter(img => 
    img.width >= currentSettings.minWidth && 
    img.height >= currentSettings.minHeight
  );
}

function initializeI18n() {
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const key = element.getAttribute('data-i18n');
    element.textContent = t(key);
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  initializeI18n();
  await loadSettings();
  setupSettingsListeners();
  displayImages();
});