// 初始化云开发
// 使用app.js中配置的默认环境
wx.cloud.init();
const db = wx.cloud.database();
const folderCol = db.collection("songFolders");
const recorder = wx.getRecorderManager();

let recordTimer = null;
let recordSeconds = 0;

// 录音配置选项
const RECORD_OPTIONS = {
  duration: 600000, // 最长录音10分钟
  sampleRate: 44100,
  numberOfChannels: 1,
  encodeBitRate: 192000,
  format: "mp3",
  frameSize: 50
};

Page({
  data: {
    folderId: "",
    folderInfo: {},
    audioFileID: "", 
    audioName: "",
    audioSize: 0,
    audioPoster: "https://picsum.photos/200/200?random=2",
    lyricContent: "",
    lyricLines: [],
    videoList: [],
    recordList: [],
    isRecording: false,
    showVideoUrlDialog: false,
    videoUrl: "",
    isAudioPlaying: false,
    isRecordPlaying: false,
    recordTimeDisplay: "00:00",
    recordTime: 0,           // 录音时长
    currentPlayRecord: null,
    isLoading: false,
    tempAudioPath: "",
    tempRecordPath: "",
    // 进度条相关状态
    isPlaying: false,   // 播放状态
    currentTime: 0,     // 当前播放时间（秒）
    totalPlayTime: 0,   // 总时长（秒）
    progressPercent: 0, // 进度条百分比（0-100）
    audioCtx: null,        // 伴奏播放器
    recordAudioCtx: null,  // 录音播放器
    isDragging: false,  // 是否正在拖动进度条
    handleTimeUpdate: null, // 存储时间更新回调，用于销毁
    playProgressTimer: null, // 备用进度定时器
    isParsingVideo: false, // 视频解析中状态
    parseVideoTips: "",    // 视频解析提示文本
    // 限制同时渲染的视频数量，解决性能问题
    maxRenderVideos: 2,    // 最多同时渲染2个视频组件
    activeVideoIndex: -1,  // 当前激活的视频索引
    urlValid: true,        // URL格式验证状态
    urlTips: "",           // URL验证提示
    canAddVideo: true,     // 是否可以添加视频
    isAddingVideo: false, // 添加视频进行中状态
    currentVideoUrl: "", // 初始化为空字符串而不是undefined
    currentVideoTitle: "", // 视频标题
    showVideoPlayer: false,
    themeColor: '#07c160', // 默认主题颜色
    isAudioContextResetting: false // 音频上下文重置状态标志
  },

  onLoad(options) {
    // 初始化音频上下文
    const audioCtx = wx.createInnerAudioContext();
    this.setData({ audioCtx });
    
    // 加载主题颜色
    const app = getApp();
    this.setData({
      themeColor: app.globalData.themeColor
    });
    
    // 注册主题颜色变化监听器
    this.registerThemeListener();

    this.getUserOpenid().then(() => {
      const folderId = options.folderId || "";
      if (!folderId.trim()) {
        wx.showToast({ title: "文件夹ID无效", icon: "none" });
        wx.navigateBack();
        return;
      }
      this.setData({ folderId: folderId.trim() });
      this.loadFolderData();
      this.initRecorder();
      if (this.data.audioFileID) {
        this.initAudioPlayer();
      }
    }).catch(err => {
      console.error("用户信息获取失败：", err);
      wx.showToast({ title: "登录失败，请重试", icon: "none" });
      setTimeout(() => wx.navigateBack(), 1500);
    });
  },

  onShow() {
    // 每次页面显示时同步主题颜色
    this.syncThemeColor();
  },
  
  // 同步主题色到导航栏
  syncThemeColor() {
    try {
      const app = getApp();
      // 优先使用全局数据中的主题色，没有则从本地存储获取
      const themeColor = app.globalData.themeColor || wx.getStorageSync('themeColor') || '#07c160';
      
      // 对于白色主题，需要将文字颜色设置为黑色以保证可见性
      const frontColor = themeColor === '#f8f8f8' ? '#000000' : '#ffffff';
      
      // 设置导航栏颜色
      wx.setNavigationBarColor({
        frontColor: frontColor,
        backgroundColor: themeColor
      });
      
      // 更新页面数据中的主题色
      if (themeColor !== this.data.themeColor) {
        this.setData({
          themeColor: themeColor
        });
      }
    } catch (error) {
      console.error('同步主题色失败:', error);
      // 出错时使用默认主题色
      this.setData({
        themeColor: '#07c160'
      });
    }
  },
  
  // 注册主题颜色变化监听器
  registerThemeListener() {
    const app = getApp();
    this.themeColorListener = (data) => {
      const { color } = data;
      // 更新主题色并同步到导航栏
      this.setData({
        themeColor: color
      });
      this.syncThemeColor();
    };
    app.on('themeColorChanged', this.themeColorListener);
  },
  
  // 页面卸载时取消注册监听器
  onUnload() {
    if (this.themeColorListener) {
      const app = getApp();
      app.off('themeColorChanged', this.themeColorListener);
    }
  },
  
  // 获取用户openid
  async getUserOpenid() {
    const openid = wx.getStorageSync("openid");
    if (openid) {
      console.log("使用缓存的openid：", openid);
      return openid;
    }

    try {
      const res = await wx.cloud.callFunction({
        name: "login"
      });
      
      if (res.result && res.result.openid) {
        wx.setStorageSync("openid", res.result.openid);
        return res.result.openid;
      } else {
        throw new Error("云函数返回数据格式错误");
      }
    } catch (err) {
      console.warn("云函数调用失败，使用临时ID：", err.message);
      const tempId = "test-" + Date.now();
      wx.setStorageSync("openid", tempId);
      return tempId;
    }
  },

  // 隐藏视频URL输入对话框
  hideVideoUrlDialog() {
    this.setData({
      showVideoUrlDialog: false,
      isAddingVideo: false,
      videoUrl: ""
    });
  },
  
  // 阻止事件冒泡到遮罩层
  stopPropagation() {
    // 空函数，仅用于阻止事件冒泡
  },
  
  // 显示对话框时初始化
  showVideoUrlDialog() {
    this.setData({
      showVideoUrlDialog: true,
      videoUrl: "",
      canAddVideo: true, // 对话框打开时即可点击
      urlTips: "请输入任意视频链接"
    });
  },

  // 处理添加视频点击
  handleAddVideo() {
    // 调试日志
    console.log('[视频添加] 点击添加按钮');
    
    // 检查是否可添加
    if (!this.data.canAddVideo) {
      console.warn('添加视频功能被禁用');
      return;
    }
    
    // 防止重复点击
    if (this.data.isAddingVideo) {
      console.log('正在添加中，请稍候');
      return;
    }
    
    // 设置加载状态
    this.setData({ isAddingVideo: true });
    
    // 显示URL输入框（不再检查数量限制）
    this.showVideoUrlDialog();
  },

  // 显示视频URL输入对话框
  onVideoUrlInput(e) {
    const videoUrl = e.detail.value;
    console.log('输入的视频URL:', videoUrl);
    
    // 只需要存储URL，不做任何验证
    this.setData({
      videoUrl: videoUrl,
      canAddVideo: true // 始终保持可点击
    });
  },
  
  async confirmAddVideo() {
    // 从页面数据中获取所需变量，确保folderId正确获取
    const { videoUrl, videoList, folderId } = this.data; 
    
    if (!videoUrl || !videoUrl.trim()) {
      wx.showToast({ title: '请输入视频链接', icon: 'none' });
      return;
    }
  
    // 预处理：去除B站链接中多余的参数（仅保留视频ID部分）
    let processedUrl = videoUrl;
    if (videoUrl.includes('bilibili.com/video/')) {
      processedUrl = videoUrl.split('?')[0]; // 截断问号后的参数
    }
  
    this.setData({ isAddingVideo: true, videoUrl: processedUrl }); // 更新处理后的URL
    
    try {
      // 调用云函数解析链接
      const res = await wx.cloud.callFunction({
        name: 'parseVideo',
        data: { videoUrl: processedUrl },
        config: { env: "cloud1-1grapwhzb010af67" }
      });
      
      if (res.result.success) {
        const videoInfo = res.result;
        
        // 检查是否已存在相同视频（防重复）
        const isDuplicate = videoList.some(v => 
          v.videoId === videoInfo.videoId || v.originalUrl === processedUrl
        );
        
        if (isDuplicate) {
          wx.showToast({ title: '该视频已添加', icon: 'none' });
          return;
        }
        
        // 构造标准化视频数据
        const newVideo = {
          videoId: videoInfo.videoId || Date.now().toString(),
          platform: videoInfo.platform || this.detectPlatform(processedUrl),
          title: videoInfo.title || this.extractVideoTitle(processedUrl), // ✅ 优先用解析标题
          originalUrl: processedUrl,
          webUrl: videoInfo.webUrl,
          realPlayUrl: videoInfo.realPlayUrl,
          createTime: new Date().toISOString(),
          coverUrl: videoInfo.coverUrl || this.getDefaultCover(videoInfo.platform)
        };
        
        // 更新本地数据
        const updatedVideos = [...videoList, newVideo];
        this.setData({ videoList: updatedVideos });
        
        // 验证folderId有效性后再更新数据库
        if (!folderId) {
          throw new Error('文件夹ID不存在，无法保存视频');
        }
        
        // 更新数据库中的视频列表
        await folderCol.doc(folderId).update({
          data: { videoList: updatedVideos }
        });
        
        wx.showToast({ title: '添加成功' });
        this.hideVideoUrlDialog();
      } else {
        wx.showToast({ 
          title: res.result.message || '视频处理失败', 
          icon: 'none',
          duration: 3000
        });
      }
    } catch (err) {
      console.error('添加视频失败:', err);
      // 更详细的错误提示
      const errorMsg = err.message.includes('文件夹ID') 
        ? err.message 
        : '处理失败，请检查链接格式或网络';
      wx.showToast({ 
        title: errorMsg, 
        icon: 'none',
        duration: 3000
      });
    } finally {
      this.setData({ isAddingVideo: false });
    }
  },

isValidVideoUrl(url) {
  return url.trim().startsWith('http://') || url.trim().startsWith('https://');
},
// 从URL提取标题（示例）
extractVideoTitle(url) {
  try {
    const urlObj = new URL(url);
    // 如果是B站链接，尝试提取BV号作为标题
    const bvMatch = url.match(/video\/(BV\w+)/);
    if (bvMatch) return `B站视频 ${bvMatch[1]}`;
    
    // 默认返回域名+路径
    return `${urlObj.hostname}${urlObj.pathname.substring(0, 20)}...`;
  } catch {
    return `视频-${Date.now().toString().slice(-4)}`;
  }
},

// 自动检测平台
detectPlatform(url) {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('bilibili')) return 'bilibili';
  if (lowerUrl.includes('douyin')) return 'douyin';
  if (lowerUrl.includes('youtube')) return 'youtube';
  return 'other';
},

  // 播放视频方法
  playVideo(e) {
    const video = e.currentTarget.dataset.video;
    if (!video || !video.realPlayUrl) {
      wx.showToast({ title: '视频信息无效', icon: 'none' });
      return;
    }
    
    // 使用新的弹窗播放器代替页面跳转
    this.showVideoPlayer(video);
  },

// 备用方案: 复制链接
copyVideoLink(url) {
  wx.setClipboardData({
    data: url,
    success: () => {
      wx.showToast({ 
        title: '链接已复制，请手动打开', 
        icon: 'none',
        duration: 2000
      });
    }
  });
},

  // 显示视频播放器弹窗
  showVideoPlayer(video) {
    if (!video || !video.realPlayUrl) {
      wx.showToast({ title: '视频信息无效', icon: 'none' });
      return;
    }
    this.setData({
      currentVideoUrl: video.realPlayUrl,
      currentVideoTitle: video.title || '视频播放',
      showVideoPlayer: true
    });
  },

  // 隐藏视频播放器弹窗
  hideVideoPlayer() {
    this.setData({
      currentVideoUrl: "", // 设置为空字符串而不是undefined
      showVideoPlayer: false,
      currentVideoTitle: ''
    });
    // 获取视频组件并停止播放
    const videoContext = wx.createVideoContext('popupVideo');
    if (videoContext) {
      videoContext.stop();
    }
  },
  
  // 复制当前视频链接
  copyCurrentVideoLink() {
    if (!this.data.currentVideoUrl) {
      wx.showToast({ title: '链接无效', icon: 'none' });
      return;
    }
    
    wx.setClipboardData({
      data: this.data.currentVideoUrl,
      success: () => {
        wx.showToast({ 
          title: '链接已复制', 
          icon: 'success',
          duration: 2000
        });
      },
      fail: () => {
        wx.showToast({ title: '复制失败，请重试', icon: 'none' });
      }
    });
  },
  
  // 切换全屏播放
  switchFullScreen() {
    const videoContext = wx.createVideoContext('popupVideo');
    if (videoContext) {
      videoContext.requestFullScreen({
        direction: 0 // 自动旋转
      });
    }
  },

  // 删除伴奏音频
  async deleteAudio() {
    const { audioFileID } = this.data;
    
    if (!audioFileID) {
      wx.showToast({ title: "没有可删除的伴奏", icon: "none" });
      return;
    }
    
    wx.showModal({
      title: "确认删除",
      content: "确定要删除当前伴奏吗？此操作不可恢复。",
      cancelText: "取消",
      confirmText: "删除",
      confirmColor: "#ff3b30",
      success: async (res) => {
        if (res.confirm) {
          try {
            this.setData({ isLoading: true });
            
            // 先删除云端文件
            if (audioFileID) {
              await wx.cloud.deleteFile({
                fileList: [audioFileID],
                config: { env: "cloud1-1grapwhzb010af67" }
              });
            }
            
            // 再更新数据库
            await this.updateFolderData({
              audioFileID: "",
              audioName: "",
              audioSize: 0
            });
            
            // 停止播放并清理
            const { audioCtx } = this.data;
            if (audioCtx) {
              audioCtx.stop();
              this.setData({
                isAudioPlaying: false,
                currentPlayRecord: null
              });
            }
            this.clearTempFile(this.data.tempAudioPath);
            
            wx.showToast({ title: "伴奏已删除" });
          } catch (err) {
            console.error("删除伴奏失败：", err);
            wx.showToast({ title: "删除失败，请重试", icon: "none" });
          } finally {
            this.setData({ isLoading: false });
          }
        }
      }
    });
  },

  // 删除歌词
  async deleteLyric() {
    const { lyricContent } = this.data;
    
    if (!lyricContent) {
      wx.showToast({ title: "没有可删除的歌词", icon: "none" });
      return;
    }
    
    wx.showModal({
      title: "确认删除",
      content: "确定要删除当前歌词吗？此操作不可恢复。",
      cancelText: "取消",
      confirmText: "删除",
      confirmColor: "#ff3b30",
      success: async (res) => {
        if (res.confirm) {
          try {
            this.setData({ isLoading: true });
            
            // 更新数据库，清除歌词内容
            await this.updateFolderData({
              lyricContent: "",
              lyricName: ""
            });
            
            wx.showToast({ title: "歌词已删除" });
          } catch (err) {
            console.error("删除歌词失败：", err);
            wx.showToast({ title: "删除失败，请重试", icon: "none" });
          } finally {
            this.setData({ isLoading: false });
          }
        }
      }
    });
  },

  // URL验证方法
  isValidVideoUrl(url) {
    if (!url || typeof url !== 'string') return false;
    
    const trimmedUrl = url.trim().toLowerCase();
    
    // 支持的平台URL格式验证
    const urlPatterns = [
      /bilibili\.com\/video\/BV\w+/i,    // B站BV号
      /bilibili\.com\/video\/av\d+/i,     // B站av号（旧版）
      /b23\.tv\/\w+/i,                   // B站短链
      /douyin\.com\/\w+/i,               // 抖音
      /iesdouyin\.com\/\w+/i,            // 抖音国际版
      /\.mp4($|\?)/i,                    // MP4直链
      /\.m3u8($|\?)/i,                   // M3U8流
      /\.mov($|\?)/i,                    // MOV格式
      /\.avi($|\?)/i,                    // AVI格式
      /\.flv($|\?)/i                     // FLV格式
    ];
    
    return urlPatterns.some(pattern => pattern.test(trimmedUrl));
  },

  // 处理音频播放错误
  onAudioError(e) {
    console.error('音频播放错误:', e.detail);
    
    // 显示错误提示给用户
    wx.showToast({
      title: '音频播放失败',
      icon: 'none',
      duration: 2000
    });
    
    // 根据错误码进行不同处理
    const errCode = e.detail.errCode;
    switch(errCode) {
      case 10001:
        console.error('音频资源地址无效');
        break;
      case 10002:
        console.error('网络错误');
        wx.showToast({
          title: '网络错误，请检查网络',
          icon: 'none',
          duration: 2000
        });
        break;
      case 10003:
        console.error('音频格式不支持');
        wx.showToast({
          title: '音频格式不支持',
          icon: 'none',
          duration: 2000
        });
        break;
      default:
        console.error('未知音频错误，错误码:', errCode);
    }
    
    // 重置音频播放状态
    this.setData({
      isAudioPlaying: false
    });
  },
  
  // 开始录音
  startRecord() {
    if (this.data.isRecording) return;
    
    // 停止任何正在播放的音频
    const { audioCtx, currentPlayRecord } = this.data;
    if (audioCtx) {
      audioCtx.stop();
    }
    
    // 检查是否有伴奏可播放
    if (!this.data.audioFileID && !this.data.tempAudioPath) {
      wx.showToast({
        title: '没有可播放的伴奏',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    // 检查录音权限
    wx.getSetting({
      success: (res) => {
        if (!res.authSetting['scope.record']) {
          wx.authorize({
            scope: 'scope.record',
            success: () => {
              this.startRecordImpl();
            },
            fail: () => {
              wx.showModal({
                title: '权限不足',
                content: '需要录音权限才能使用录音功能，请在设置中开启',
                confirmText: '去设置',
                success: (modalRes) => {
                  if (modalRes.confirm) {
                    wx.openSetting();
                  }
                }
              });
            }
          });
        } else {
          this.startRecordImpl();
        }
      }
    });
  },

  // 实际执行录音的实现方法
  startRecordImpl() {
    recorder.start(RECORD_OPTIONS);
    
    // 1. 初始化并播放伴奏
    const accompCtx = wx.createInnerAudioContext();
    accompCtx.autoplay = true;
    accompCtx.loop = true;

    const audioSource = this.data.tempAudioPath || this.data.audioFileID;
    accompCtx.src = audioSource;

    
    accompCtx.onError((err) => {
      console.error('伴奏播放错误:', err);
      wx.showToast({ title: '伴奏播放失败', icon: 'none' });
    });
  
    this.setData({
      isRecording: true,
      recordTime: 0,
      audioCtx: accompCtx,  // ✅ audioCtx 专门存伴奏
      isAudioPlaying: true
    });
    
    // 开始计时
    this.recordTimer = setInterval(() => {
      const newRecordTime = this.data.recordTime + 1000;
      this.setData({
        recordTime: newRecordTime
      });
      // 同步更新recordTimeDisplay
      const minutes = Math.floor(newRecordTime / 60000).toString().padStart(2, "0");
      const seconds = Math.floor((newRecordTime % 60000) / 1000).toString().padStart(2, "0");
      this.setData({ recordTimeDisplay: `${minutes}:${seconds}` });
    }, 1000);
  },

  // 停止录音
stopRecord() {
  if (!this.data.isRecording) return;

  // 1. 停止录音
  recorder.stop();
  this.clearRecordTimer();

  // 2. 停止伴奏播放
  const { audioCtx } = this.data;
  if (audioCtx) {
    try {
      audioCtx.stop();
      audioCtx.destroy();
    } catch (err) {
      console.warn('停止伴奏播放时出错:', err);
    }
    this.setData({ audioCtx: null });
  }

  this.setData({
    isRecording: false,
    isAudioPlaying: false
  });

  // 4. 处理录音结果
  recorder.onStop((res) => {
    if (res.duration < 1000) {
      wx.showToast({ title: "录音时间太短", icon: "none" });
      this.clearTempFile(res.tempFilePath);
      return;
    }

    // 计算录音时长并格式化
    const recordSeconds = Math.floor(this.data.recordTime / 1000);
    const minutes = Math.floor(recordSeconds / 60).toString().padStart(2, "0");
    const seconds = (recordSeconds % 60).toString().padStart(2, "0");
    const formattedTime = `${minutes}:${seconds}`;

    // ⚡ 先生成一个本地可播放的录音对象
    const recordId = Date.now().toString();
    // 确保tempPath是本地文件系统路径，而不是HTTP URL格式
    let localTempPath = res.tempFilePath;
    let isFileCopied = false;
    
    try {
      if (localTempPath.startsWith('http://') || localTempPath.startsWith('https://')) {
        console.log("原始临时文件路径:", localTempPath);
        
        // 生成一个基于时间戳的唯一本地路径
        const timestamp = Date.now();
        const newLocalTempPath = `${wx.env.USER_DATA_PATH}/${timestamp}-record.mp3`;
        console.log("生成唯一本地路径:", newLocalTempPath);
        
        // 使用FileSystemManager尝试复制文件
        const fs = wx.getFileSystemManager();
        
        try {
          // 尝试直接复制文件
          fs.copyFileSync(localTempPath, newLocalTempPath);
          localTempPath = newLocalTempPath;
          isFileCopied = true;
          console.log("文件复制成功，使用新路径:", localTempPath);
        } catch (copyErr) {
          console.warn("直接复制文件失败，尝试其他方法:", copyErr);
          
          // 如果直接复制失败，先检查原始文件是否存在
          try {
            fs.accessSync(localTempPath);
            console.log("原始文件存在，但复制失败，使用原始路径");
            // 文件存在但复制失败，继续使用原始路径
          } catch (accessErr) {
            console.error("原始文件不存在，创建空文件占位:", accessErr);
            
            // 创建一个空文件作为占位符，确保路径有效
            try {
              fs.writeFileSync(newLocalTempPath, '', 'binary');
              localTempPath = newLocalTempPath;
              isFileCopied = true;
              console.log("已创建空文件占位符:", localTempPath);
            } catch (writeErr) {
              console.error("创建空文件失败:", writeErr);
              // 如果所有方法都失败，使用原始路径
            }
          }
        }
      }
      
      // 验证最终路径是否有效
      try {
        const fs = wx.getFileSystemManager();
        fs.accessSync(localTempPath);
        console.log("验证文件路径有效:", localTempPath);
      } catch (accessErr) {
        console.error("最终文件路径无效:", accessErr);
        // 路径无效，但我们仍继续，因为uploadFile会处理实际的文件上传
      }
    } catch (fsErr) {
      console.error("文件系统操作异常:", fsErr);
      // 发生异常时保持原始路径
    }
    
    const newRecord = {
      recordId,
      fileID: "",                 // 先留空，上传后再补
      tempPath: localTempPath,    // 确保使用本地文件系统路径
      isFileCopied,               // 标记文件是否已成功复制到本地
      createTime: new Date().toISOString(),
      name: `录音-${formattedTime}.mp3`,
      durationFromName: formattedTime,
      formattedCreateTime: this.formatRecordCreateTime(new Date()),
      progressPercent: 0,
      currentTime: 0,
      duration: recordSeconds,
      totalDuration: recordSeconds // 同时设置totalDuration，确保进度条和播放正常工作
    };
    
    console.log("创建新录音对象:", JSON.stringify(newRecord, null, 2));

    // 先更新 UI，用户可立即播放
    const currentRecordList = [...this.data.recordList, newRecord];
    this.setData({ recordList: currentRecordList });

    // ✅ 异步上传到云端，成功后再补 fileID
    this.uploadFile(
      { path: res.tempFilePath, size: res.fileSize, name: newRecord.name },
      "record",
      recordId
    );
  });
},


  // 从录音名称提取时长
  extractDurationFromName(name) {
    if (!name || typeof name !== 'string') return '00:00';
    
    // 匹配 "录音-00:08" 格式中的时间部分
    const durationMatch = name.match(/录音-(\d{2}:\d{2})/);
    if (durationMatch && durationMatch[1]) {
      return durationMatch[1];
    }
    
    // 匹配其他可能的格式
    const timeMatch = name.match(/(\d{2}:\d{2})/);
    return timeMatch && timeMatch[1] ? timeMatch[1] : '00:00';
  },

  // 格式化创建时间 - 只显示年月日
  formatCreateTime(time) {
    if (!time) return '未知时间';
    
    // 处理不同类型的时间数据
    let date;
    if (time._seconds) {
      date = new Date(time._seconds * 1000);
    } else if (typeof time === 'string') {
      date = new Date(time);
    } else if (time instanceof Date) {
      date = time;
    } else {
      // 尝试直接将对象转换为时间戳
      try {
        const timestamp = parseInt(JSON.stringify(time).match(/(\d{13})/)[0]);
        date = new Date(timestamp);
      } catch {
        return '无效时间';
      }
    }
    
    // 检查是否为有效日期
    if (isNaN(date.getTime())) return '无效时间';
    
    // 格式化显示 - 只显示年月日
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  },
  
  // 格式化录音创建时间 - 使用24小时制显示完整时间
  formatRecordCreateTime(time) {
    if (!time) return '未知时间';
    
    // 处理不同类型的时间数据
    let date;
    if (time._seconds) {
      date = new Date(time._seconds * 1000);
    } else if (typeof time === 'string') {
      date = new Date(time);
    } else if (time instanceof Date) {
      date = time;
    } else {
      // 尝试直接将对象转换为时间戳
      try {
        const timestamp = parseInt(JSON.stringify(time).match(/(\d{13})/)[0]);
        date = new Date(timestamp);
      } catch {
        return '无效时间';
      }
    }
    
    // 检查是否为有效日期
    if (isNaN(date.getTime())) return '无效时间';
    
    // 格式化显示 - 使用24小时制显示完整时间
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false // 使用24小时制
    });
  },

  // 加载文件夹数据并处理录音信息
  async loadFolderData() {
    const { folderId } = this.data;
    if (!folderId.trim()) {
      wx.showToast({ title: "文件夹ID为空", icon: "none" });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }

    this.setData({ 
      isLoading: true,
      canAddVideo: true // 确保可以添加视频
    });
    try {
      const res = await folderCol.doc(folderId.trim()).get({
        config: { env: "cloud1-1grapwhzb010af67" }
      });

      if (!res.data) {
        throw new Error("文件夹不存在");
      }

      const data = res.data;
      const lyricLines = data.lyricContent ? data.lyricContent.split("\n") : [];
      
      // 处理录音列表，提取时长和格式化时间
      let processedRecords = [];
      if (data.recordList && Array.isArray(data.recordList)) {
        processedRecords = data.recordList.map(record => {
          // 从名称提取时长
          const durationFromName = this.extractDurationFromName(record.name);
          // 格式化录音创建时间 - 使用24小时制
          const formattedCreateTime = this.formatRecordCreateTime(record.createTime);
          
          return {
            ...record,
            durationFromName,
            formattedCreateTime,
            progressPercent: 0,  // 初始化进度
            currentTime: 0       // 初始化当前播放时间
          };
        });
      }

      this.setData({
        folderInfo: {
          name: data.name || "未命名文件夹",
          createTime: data.createTime || db.serverDate(),
          formattedCreateTime: this.formatCreateTime(data.createTime || db.serverDate()),
          folderId: data._id
        },
        audioFileID: data.audioFileID || "",
        audioName: data.audioName || "",
        audioSize: data.audioSize || 0,
        lyricContent: data.lyricContent || "",
        lyricLines,
        videoList: data.videoList || [],
        recordList: processedRecords
      });
    } catch (err) {
      let errorMsg = "数据加载失败";
      if (err.message.includes("cannot find document") || err.message.includes("不存在")) {
        errorMsg = "文件夹不存在（可能已删除）";
      } else if (err.message.includes("permission")) {
        errorMsg = "无访问权限，请检查设置";
      }
      wx.showToast({ title: errorMsg, icon: "none" });
      console.error("加载文件夹错误：", err);
      setTimeout(() => wx.navigateBack(), 2000);
    } finally {
      this.setData({ isLoading: false });
    }
  },
  
  // 重置音频上下文
  resetAudioContext() {
    try {
      const { audioCtx } = this.data;
      // 安全地停止和销毁现有的音频上下文
      if (audioCtx && typeof audioCtx.destroy === 'function') {
        try {
          if (typeof audioCtx.stop === 'function') {
            audioCtx.stop();
          }
          // 清除所有事件监听器
          if (typeof audioCtx.offCanplay === 'function') audioCtx.offCanplay();
          if (typeof audioCtx.offError === 'function') audioCtx.offError();
          if (typeof audioCtx.offTimeUpdate === 'function') audioCtx.offTimeUpdate();
          if (typeof audioCtx.offEnded === 'function') audioCtx.offEnded();
          audioCtx.destroy();
        } catch (err) {
          console.warn('重置销毁音频上下文时出错:', err);
        }
      }
      // 创建新的音频上下文
      const newAudioCtx = wx.createInnerAudioContext();
      newAudioCtx.obeyMuteSwitch = false;
      newAudioCtx.volume = 1;
      
      this.setData({
        audioCtx: newAudioCtx,
        currentPlayRecord: '',
        isAudioPlaying: false
      });
      
      console.log('音频上下文已重置');
    } catch (err) {
      console.error('重置音频上下文失败:', err);
      this.setData({
        audioCtx: null,
        currentPlayRecord: '',
        isAudioPlaying: false
      });
    }
  },
  
  // 重置录音播放状态
  resetRecordingState() {
    try {
      clearInterval(recordTimer);
      recordTimer = null;
      recordSeconds = 0;
      
      this.setData({
        isRecording: false,
        recordSeconds: 0,
        isAudioPlaying: false,
        currentPlayRecord: ''
      });
    } catch (err) {
      console.error('重置录音状态失败:', err);
    }
  },
  
  // 获取或创建独立的录音播放器（recordAudioCtx）
  getRecordAudioCtx() {
    let { recordAudioCtx } = this.data;
    if (!recordAudioCtx) {
      recordAudioCtx = wx.createInnerAudioContext();
      recordAudioCtx.obeyMuteSwitch = false;
      recordAudioCtx.volume = 1;
      this.setData({ recordAudioCtx });
      this.initRecordPlayer();
    }
    return recordAudioCtx;
  },

  // 初始化录音播放器的事件监听（单独于伴奏播放器）
  initRecordPlayer() {
    const { recordAudioCtx } = this.data;
    if (!recordAudioCtx) return;
  
    // 清理旧监听
    try {
      if (typeof recordAudioCtx.offCanplay === 'function') recordAudioCtx.offCanplay();
      if (typeof recordAudioCtx.offError === 'function') recordAudioCtx.offError();
      if (typeof recordAudioCtx.offTimeUpdate === 'function') recordAudioCtx.offTimeUpdate();
      if (typeof recordAudioCtx.offEnded === 'function') recordAudioCtx.offEnded();
    } catch (e) {}
  
    // 录音播放错误处理
    recordAudioCtx.onError(err => {
      console.error('录音播放器错误:', err);
      this.setData({ isRecordPlaying: false, currentPlayRecord: null });
      wx.showToast({ title: '录音播放失败', icon: 'none' });
    });
  
    recordAudioCtx.onCanplay(() => {
      const { currentPlayRecord, recordList } = this.data;
      if (currentPlayRecord) {
        const updated = recordList.map(r => r.recordId === currentPlayRecord ? { ...r, totalDuration: recordAudioCtx.duration } : r);
        this.setData({ recordList: updated });
      }
    });
  
    recordAudioCtx.onTimeUpdate(() => {
      const { isDragging, currentPlayRecord } = this.data;
      if (!isDragging && currentPlayRecord && !isNaN(recordAudioCtx.duration)) {
        this.updateRecordingProgress(currentPlayRecord, recordAudioCtx.currentTime, recordAudioCtx.duration);
      }
    });
  
    recordAudioCtx.onEnded(() => {
      const updatedRecords = this.data.recordList.map(item => item.recordId === this.data.currentPlayRecord ? { ...item, progressPercent: 0, currentTime: 0 } : item);
      this.setData({
        isRecordPlaying: false,
        currentPlayRecord: null,
        recordList: updatedRecords
      });
      this.clearTempFile(this.data.tempRecordPath);
      
      // 播放结束后清理音频上下文
      if (recordAudioCtx) {
        try {
          recordAudioCtx.stop();
          recordAudioCtx.src = '';
        } catch (e) {
          console.warn('清理音频上下文失败:', e);
        }
      }
    });
  },
  

  // 播放录音（使用独立的 recordAudioCtx，不再和伴奏共用 audioCtx）
  async playRecording(e) {
    const record = e.currentTarget.dataset.record;
    if (!record) {
      wx.showToast({ title: "录音信息无效", icon: "none" });
      return;
    }

    let { currentPlayRecord, tempRecordPath, recordAudioCtx, recordList } = this.data;

    // 确保录音播放器存在
    if (!recordAudioCtx) {
      recordAudioCtx = wx.createInnerAudioContext();
      recordAudioCtx.obeyMuteSwitch = false;
      recordAudioCtx.volume = 1;
      this.setData({ recordAudioCtx });
    }

    // 如果当前正在播放同一条录音，做播放/暂停切换
    if (currentPlayRecord === record.recordId) {
      if (recordAudioCtx.paused || !recordAudioCtx.src) {
        // 如果音频上下文没有src或者已暂停，重新设置src并播放
        try {
          let audioSource = null;
          if (record.tempPath) {
            audioSource = record.tempPath;
          } else if (record.fileID) {
            const newTempPath = `${wx.env.USER_DATA_PATH}/${Date.now()}-record.mp3`;
            const downloadRes = await wx.cloud.downloadFile({
              fileID: record.fileID,
              tempFilePath: newTempPath
            });
            audioSource = downloadRes.tempFilePath;
            this.setData({ tempRecordPath: audioSource });
          }
          
          if (audioSource) {
            // 检查路径格式，确保兼容
            if (!audioSource.startsWith('wxfile://')) {
              recordAudioCtx.src = audioSource;
            } else {
              recordAudioCtx.src = audioSource;
            }
            recordAudioCtx.play();
            this.setData({ isRecordPlaying: true });
            // 启动备用进度更新定时器
            this.startBackupProgressTimer(record.recordId, recordAudioCtx);
          }
        } catch (err) {
          console.error('重新播放录音失败:', err);
          wx.showToast({ title: "播放失败", icon: "none" });
        }
      } else {
        recordAudioCtx.pause();
        this.setData({ isRecordPlaying: false });
        // 暂停时停止备用进度定时器
        this.stopBackupProgressTimer();
      }
      return;
    }

    // 停止之前的录音播放，但不清理临时文件
    if (currentPlayRecord) {
      try {
        if (recordAudioCtx && typeof recordAudioCtx.stop === 'function') {
          recordAudioCtx.stop();
        }
        // 只更新状态，不清理临时文件
        this.setData({
          isRecordPlaying: false,
          isAudioPlaying: false,
          currentPlayRecord: null
        });
        // 停止之前的备用进度定时器
        this.stopBackupProgressTimer();
      } catch (err) {
        console.error('停止之前的录音播放出错:', err);
      }
    }
    
    // 停止伴奏播放（互斥机制）
    const { audioCtx } = this.data;
    if (audioCtx && !audioCtx.paused) {
      audioCtx.stop();
    }

    this.setData({ isLoading: true });

    // 查找进度信息
    const existingRecord = recordList.find(item => item.recordId === record.recordId);
    const savedTime = existingRecord ? existingRecord.currentTime : 0;

    let newTempPath;
    try {
      let audioSource = null;

      // ✅ 优先使用本地临时路径
      if (record.tempPath) {
        audioSource = record.tempPath;
      }

      // 否则用云端 fileID 下载
      if (!audioSource) {
        if (!record.fileID) throw new Error("录音文件未准备好，请稍后重试");

        newTempPath = `${wx.env.USER_DATA_PATH}/${Date.now()}-record.mp3`;
        const downloadRes = await wx.cloud.downloadFile({
          fileID: record.fileID,
          tempFilePath: newTempPath
        });

        audioSource = downloadRes.tempFilePath;
      }

      // 清除旧监听
      recordAudioCtx.offCanplay();
      recordAudioCtx.offError();
      recordAudioCtx.offTimeUpdate();
      recordAudioCtx.offEnded();

      // 设置音频源，确保路径格式兼容
      if (!audioSource.startsWith('wxfile://')) {
        recordAudioCtx.src = audioSource;
      } else {
        recordAudioCtx.src = audioSource;
      }
      recordAudioCtx.obeyMuteSwitch = false;
      recordAudioCtx.volume = 1;

      return await new Promise((resolve, reject) => {
        const canplayHandler = () => {
          recordAudioCtx.offCanplay(canplayHandler);
          recordAudioCtx.play();
        
          const withDurationRecords = recordList.map(item => {
            if (item.recordId === record.recordId) {
              return { ...item, totalDuration: record.duration || recordAudioCtx.duration };
            }
            return item;
          });
        
          this.setData({
            currentPlayRecord: record.recordId,
            tempRecordPath: audioSource,
            isLoading: false,
            isRecordPlaying: true,
            isAudioPlaying: false, // 确保伴奏播放状态为false
            recordList: withDurationRecords
          });

          if (savedTime > 0 && !isNaN(recordAudioCtx.duration) && recordAudioCtx.duration > 0) {
            setTimeout(() => {
              try {
                recordAudioCtx.currentTime = savedTime;
              } catch (err) {
                console.warn("跳转进度失败:", err);
              }
            }, 100);
          }
          
          // 启动备用进度更新定时器
          this.startBackupProgressTimer(record.recordId, recordAudioCtx);
          resolve();
        };

        const errorHandler = (err) => {
          recordAudioCtx.offError(errorHandler);
          console.error("录音播放错误：", err);
          // 停止备用进度定时器
          this.stopBackupProgressTimer();
          reject(new Error(err && err.errMsg ? err.errMsg : "播放失败"));
        };

        const timeUpdateHandler = () => {
          const { isDragging } = this.data;
          if (!isDragging && !isNaN(recordAudioCtx.duration)) {
            this.updateRecordingProgress(
              record.recordId,
              recordAudioCtx.currentTime,
              recordAudioCtx.duration
            );
          }
        };

        const endedHandler = () => {
          const updatedRecords = this.data.recordList.map(item => {
            if (item.recordId === record.recordId) {
              return { ...item, progressPercent: 0, currentTime: 0 };
            }
            return item;
          });

          this.setData({
            isRecordPlaying: false,
            isAudioPlaying: false, // 确保伴奏播放状态为false
            currentPlayRecord: null,
            recordList: updatedRecords
          });
          
          // 停止备用进度定时器
          this.stopBackupProgressTimer();
          
          // 播放结束后清理音频上下文，确保下次可以重新播放
          if (recordAudioCtx) {
            try {
              recordAudioCtx.stop();
              recordAudioCtx.src = '';
            } catch (e) {
              console.warn('清理音频上下文失败:', e);
            }
          }
        };

        recordAudioCtx.onCanplay(canplayHandler);
        recordAudioCtx.onError(errorHandler);
        recordAudioCtx.onTimeUpdate(timeUpdateHandler);
        recordAudioCtx.onEnded(endedHandler);
      });

    } catch (err) {
      this.setData({ isLoading: false });
      console.error("播放录音失败：", err);
      wx.showToast({ title: `播放失败：${err.message || err}`, icon: "none" });
      // 停止备用进度定时器
      this.stopBackupProgressTimer();
      if (newTempPath) this.clearTempFile(newTempPath);
    }
  },


  // 更新录音进度 - 确保进度条平滑移动，同时保存进度值用于后续播放
  updateRecordingProgress(recordId, currentTime, duration) {
    const { recordList } = this.data;
    if (!recordId || !recordList.length) return;
    
    // 找到对应的录音
    const recordIndex = recordList.findIndex(item => item.recordId === recordId);
    if (recordIndex === -1) {
      console.warn("更新进度时未找到对应录音");
      return;
    }
    
    const record = recordList[recordIndex];
    // 确保duration始终有有效值，避免进度条计算错误
    // 优先级：duration参数 > record.duration > record.totalDuration
    const totalDuration = duration || record.duration || record.totalDuration || 0;
    
    // 确保计算的进度值有效且在0-100之间
    const progressPercent = totalDuration > 0 ? Math.min(Math.max(Math.floor((currentTime / totalDuration) * 100), 0), 100) : 0;
    
    // 更新对应录音的进度
    this.setData({
      [`recordList[${recordIndex}].progressPercent`]: progressPercent,
      [`recordList[${recordIndex}].currentTime`]: Math.floor(currentTime),
      [`recordList[${recordIndex}].totalDuration`]: totalDuration, // 确保总时长被保存
      [`recordList[${recordIndex}].duration`]: totalDuration // 也保存到duration，确保多位置使用时都能获取到有效时长
    }, () => {
      console.log("录音进度已更新，recordId:", recordId, "currentTime:", currentTime, "totalDuration:", totalDuration);
    });
  },

  // 初始化音频播放器
  initAudioPlayer() {
    const { audioFileID, audioCtx } = this.data;
    if (!audioFileID) {
      console.warn("没有伴奏文件，不初始化播放器");
      return;
    }
    if (!audioCtx) return;

    // 移除旧的所有事件监听（避免重复绑定）
    if (this.data.handleTimeUpdate) {
      audioCtx.offTimeUpdate(this.data.handleTimeUpdate);
      audioCtx.offEnded();
      audioCtx.offError();
      audioCtx.offCanplay();
    }

    // 音频错误处理
    audioCtx.onError(err => {
      console.error("音频播放错误详情：", err);
      this.setData({
        isRecordPlaying: false,
        isAudioPlaying: false,
        currentPlayRecord: null
      });

      let errorMsg = "播放失败";
      switch (err.errCode) {
        case 10001: errorMsg = "音频文件无效"; break;
        case 10002: errorMsg = "网络错误（文件下载失败）"; break;
        case 10003: errorMsg = "格式不支持（仅MP3/WAV/AAC）"; break;
        case 10004: errorMsg = "文件已删除或路径无效"; break;
        default: errorMsg = "播放失败";
      }
      wx.showToast({ title: errorMsg, icon: "none" });
    });

    // 音频播放结束处理 - 确保进度条归位和图标切换
    audioCtx.onEnded(() => {
      const { currentPlayRecord } = this.data;
      
      // 重置当前播放录音的进度
      const updatedRecords = this.data.recordList.map(item => {
        if (item.recordId === currentPlayRecord) {
          return {
            ...item,
            progressPercent: 0,  // 进度条归位
            currentTime: 0       // 重置当前时间
          };
        }
        return item;
      });
      
      this.setData({
        isAudioPlaying: false,  // 切换到播放图标
        currentPlayRecord: null,
        recordList: updatedRecords
      });
      this.clearTempFile(this.data.tempRecordPath);
    });

    // 核心：时间更新监听（实时更新进度条）
    const handleTimeUpdate = () => {
      const { isAudioPlaying, isRecordPlaying, isDragging, currentPlayRecord } = this.data;
      // 播放中、未拖动、有当前播放录音、时长有效时更新进度
      if (isRecordPlaying && !isDragging && currentPlayRecord && !isNaN(audioCtx.duration)) {
        this.updateRecordingProgress(
          currentPlayRecord,
          audioCtx.currentTime,
          audioCtx.duration
        );
      }
    };
    this.setData({ handleTimeUpdate }); // 存储回调用于销毁
    audioCtx.onTimeUpdate(handleTimeUpdate);

    // 音频可播放时初始化进度
    audioCtx.onCanplay(() => {
      const { isDragging, currentPlayRecord } = this.data;
      if (!isDragging && currentPlayRecord && !isNaN(audioCtx.duration)) {
        // 存储总时长到录音对象中
        const withDurationRecords = this.data.recordList.map(item => {
          if (item.recordId === currentPlayRecord) {
            return {
              ...item,
              totalDuration: audioCtx.duration // 存储总时长
            };
          }
          return item;
        });
        this.setData({ recordList: withDurationRecords });
        
        this.updateRecordingProgress(
          currentPlayRecord,
          audioCtx.currentTime,
          audioCtx.duration
        );
      }
    });

    // 清理备用定时器
    if (this.data.playProgressTimer) {
      clearInterval(this.data.playProgressTimer);
      this.setData({ playProgressTimer: null });
    }
  },

  // 进度条开始拖动
onProgressTouchStart(e) {
  const recordId = e.currentTarget.dataset.recordid;
  console.log("进度条开始拖动，recordId:", recordId);

  if (!recordId) {
    console.warn("未找到recordId");
    return;
  }

  // 找到对应录音
  const record = this.data.recordList.find(item => item.recordId === recordId);
  if (!record) {
    console.warn("未找到对应录音");
    return;
  }

  // 如果拖动的是当前播放的录音，暂停录音播放器
  const { currentPlayRecord } = this.data;
  const recordAudioCtx = this.data.recordAudioCtx;
  if (currentPlayRecord === recordId && recordAudioCtx && !recordAudioCtx.paused) {
    console.log("拖动开始时暂停录音播放");
    recordAudioCtx.pause();
    this.setData({ isRecordPlaying: false });
  }

  // 保存当前拖动的录音ID并更新状态
  this.setData({
    isDragging: true,
    dragRecordId: recordId
  });
},

// 进度条拖动中（实时更新显示）
onProgressTouchMove(e) {
  const recordId = e.currentTarget?.dataset?.recordid || this.data.dragRecordId;
  console.log("进度条拖动中，recordId:", recordId);

  if (!recordId || !this.data.isDragging) return;
  if (!e.touches || !Array.isArray(e.touches) || e.touches.length === 0) return;

  try {
    const windowInfo = wx.getWindowInfo();
    const windowWidth = windowInfo.windowWidth;

    const fallbackWrapLeft = windowWidth * 0.15;
    const fallbackWrapWidth = windowWidth * 0.7;

    let touchX = e.touches[0].clientX;
    touchX = Math.max(touchX, fallbackWrapLeft);
    touchX = Math.min(touchX, fallbackWrapLeft + fallbackWrapWidth);

    const percent = Math.round(((touchX - fallbackWrapLeft) / fallbackWrapWidth) * 100);

    const record = this.data.recordList.find(item => item.recordId === recordId);
    if (!record) return;

    const duration = !isNaN(record.totalDuration) ? record.totalDuration : 0;
    const currentTime = duration > 0 ? (percent / 100) * duration : 0;

    const updatedRecords = this.data.recordList.map(item => {
      if (item.recordId === recordId) {
        return {
          ...item,
          progressPercent: percent,
          currentTime: Math.floor(currentTime)
        };
      }
      return item;
    });

    this.setData({ recordList: updatedRecords });
  } catch (err) {
    console.error("进度条拖动处理异常:", err);
  }
},

// 进度条拖动结束（跳转到指定进度）
onProgressTouchEnd(e) {
  const recordId = e.currentTarget.dataset.recordid || this.data.dragRecordId;
  let { isRecordPlaying, recordList } = this.data;
  const recordAudioCtx = this.data.recordAudioCtx;

  console.log("进度条拖动结束，recordId:", recordId);

  if (!recordId) {
    this.setData({ isDragging: false, dragRecordId: null });
    return;
  }

  try {
    const windowInfo = wx.getWindowInfo();
    const windowWidth = windowInfo.windowWidth;

    const fallbackWrapLeft = windowWidth * 0.15;
    const fallbackWrapWidth = windowWidth * 0.7;

    let touchX = e.changedTouches[0].clientX;
    touchX = Math.max(touchX, fallbackWrapLeft);
    touchX = Math.min(touchX, fallbackWrapLeft + fallbackWrapWidth);

    const percent = Math.round(((touchX - fallbackWrapLeft) / fallbackWrapWidth) * 100);

    const record = recordList.find(item => item.recordId === recordId);
    if (!record) {
      this.setData({ isDragging: false, dragRecordId: null });
      return;
    }

    const duration = record.totalDuration || 0;

    if (duration > 0) {
      const targetTime = Math.min((percent / 100) * duration, duration);

      this.updateRecordingProgress(recordId, targetTime, duration);

      if (this.data.currentPlayRecord === recordId && recordAudioCtx) {
        try {
          recordAudioCtx.currentTime = targetTime;
        } catch (err) {
          console.warn("设置录音播放位置失败:", err);
        }

        if (isRecordPlaying) {
          setTimeout(() => {
            try {
              recordAudioCtx.play();
              this.setData({ isRecordPlaying: true });
            } catch (err) {
              console.error("拖动后播放失败:", err);
              wx.showToast({ title: "播放失败", icon: "none" });
            }
          }, 50);
        }        
      }
    }
  } catch (err) {
    console.error("进度条拖动结束处理异常:", err);
  } finally {
    this.setData({ isDragging: false, dragRecordId: null });
  }
},


  // 播放/暂停切换
  ttoggleRecordPlay(e) {
    const recordId = e.currentTarget.dataset.recordid;
    if (!recordId) return;
  
    const { isRecordPlaying, currentPlayRecord } = this.data;
    if (currentPlayRecord !== recordId) return;
  
    const recordAudioCtx = this.getRecordAudioCtx();
    try {
      if (isRecordPlaying) {
        recordAudioCtx.pause();
        this.setData({ isRecordPlaying: false });
      } else {
        recordAudioCtx.play();
        this.setData({ isRecordPlaying: true });
      }
    } catch (err) {
      console.error('toggleRecordPlay 出错:', err);
      wx.showToast({ title: '播放失败，请重试', icon: 'none' });
    }
  },
  
  

  // 格式化时间（秒转 分:秒）
  formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return "00:00";
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  },

  // 页面卸载时清理资源
  // 修改后的onUnload方法
onUnload() {
  // 停止录音
  if (this.data.isRecording) {
    recorder.stop();
  }
  
  // 清理录音计时器
  if (recordTimer) {
    clearInterval(recordTimer);
    recordTimer = null;
  }
  
  // 清理播放进度定时器
  if (this.data.playProgressTimer) {
    clearInterval(this.data.playProgressTimer);
    this.setData({ playProgressTimer: null });
  }
  
  // 安全地销毁音频上下文
  try {
    const { audioCtx } = this.data;
    if (audioCtx && typeof audioCtx.destroy === 'function') {
      try {
        if (typeof audioCtx.stop === 'function') {
          audioCtx.stop();
        }
        audioCtx.destroy();
      } catch (err) {
        console.warn('销毁音频上下文时出错:', err);
      }
      this.setData({ audioCtx: null });
    }
  } catch (outerErr) {
    console.error('onUnload处理音频上下文异常:', outerErr);
  }
  
  // 重置录音计时器和播放状态
  this.resetRecordingState();
  
  // 清理临时文件
  this.clearTempFile(this.data.tempAudioPath);
  this.clearTempFile(this.data.tempRecordPath);
},

  // 初始化录音器
  // 初始化录音器
initRecorder() {
  recorder.onStart(() => {
    console.log("录音开始");
    recordSeconds = 0;
    this.updateRecordTime();
    recordTimer = setInterval(() => {
      recordSeconds++;
      this.updateRecordTime();
    }, 1000);
  });

  recorder.onStop((res) => {
    if (res.duration < 1000) {
      wx.showToast({ title: "录音时间太短", icon: "none" });
      this.clearTempFile(res.tempFilePath);
      return;
    }

    const recordSeconds = Math.floor(res.duration / 1000);
    const minutes = Math.floor(recordSeconds / 60).toString().padStart(2, "0");
    const seconds = (recordSeconds % 60).toString().padStart(2, "0");
    const formattedTime = `${minutes}:${seconds}`;

    const recordId = Date.now().toString();
    const newRecord = {
      recordId,
      fileID: "", // 上传后再补
      tempPath: res.tempFilePath, // ✅ 本地临时路径
      createTime: new Date().toISOString(),
      name: `录音-${formattedTime}.mp3`,
      durationFromName: formattedTime,
      formattedCreateTime: this.formatRecordCreateTime(new Date()),
      progressPercent: 0,
      currentTime: 0,
      duration: recordSeconds
    };

    // 更新 UI
    const currentRecordList = [...this.data.recordList, newRecord];
    this.setData({ recordList: currentRecordList });

    // 异步上传云端
    this.uploadFile(
      { path: res.tempFilePath, size: res.fileSize, name: newRecord.name },
      "record",
      recordId
    );
  });

  recorder.onError(err => {
    console.error("录音错误详情：", err);
    this.setData({ isRecording: false });
    wx.showToast({ title: `录音失败：${err.message || "未知错误"}`, icon: "none" });
    this.clearRecordTimer();
  });
},


  // 更新录音时间显示（备用方法，主要逻辑已集成到计时器中）
  updateRecordTime() {
    const recordSeconds = Math.floor(this.data.recordTime / 1000);
    const minutes = Math.floor(recordSeconds / 60).toString().padStart(2, "0");
    const seconds = (recordSeconds % 60).toString().padStart(2, "0");
    this.setData({ recordTimeDisplay: `${minutes}:${seconds}` });
  },

  // 清除录音计时器
  clearRecordTimer() {
    if (recordTimer) {
      clearInterval(recordTimer);
      recordTimer = null;
    }
  },

  // 格式化时长
  formatDuration(duration) {
    if (isNaN(duration) || duration < 0) return "00:00";
    const minutes = Math.floor(duration / 60).toString().padStart(2, '0');
    const seconds = (duration % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  },
  
  // 选择伴奏音频
  chooseAudio() {
    wx.chooseMessageFile({
      count: 1,
      type: "file",
      extension: ["mp3", "wav", "aac"],
      success: (res) => {
        const tempFile = res.tempFiles[0];
        const ext = tempFile.name.split(".").pop().toLowerCase();
        const validExts = ["mp3", "wav", "aac"];
        
        if (!validExts.includes(ext)) {
          wx.showToast({ title: `仅支持${validExts.join('、')}格式`, icon: "none" });
          return;
        }
        
        if (tempFile.size > 100 * 1024 * 1024) {
          wx.showToast({ title: "音频不能超过100MB", icon: "none" });
          return;
        }
        
        this.uploadFile(tempFile, "audio");
      },
      fail: (err) => {
        console.error("选择音频失败：", err);
        wx.showToast({ title: "选择音频失败", icon: "none" });
      }
    });
  },

  // 切换伴奏播放状态
  toggleAudioPlay() {
    const { audioFileID, isAudioPlaying, currentPlayRecord, tempAudioPath, audioCtx } = this.data;
    
    if (!audioCtx) {
      wx.showToast({ title: "播放器初始化中", icon: "none" });
      return;
    }
    
    if (!audioFileID) {
      wx.showToast({ title: "请先上传伴奏", icon: "none" });
      return;
    }

    // 关键修复：如果正在播放录音，强制停止录音
if (currentPlayRecord) {
  console.log("检测到正在播放录音，强制停止录音");
  try {
    if (this.data.recordAudioCtx && typeof this.data.recordAudioCtx.stop === 'function') {
      this.data.recordAudioCtx.stop();
      console.log("已停止录音播放");
    }
    this.setData({ 
      currentPlayRecord: null,
      isRecordPlaying: false
    });
    this.clearTempFile(this.data.tempRecordPath);
  } catch (stopErr) {
    console.warn("停止录音时出错:", stopErr);
  }
}


    // 已播放 → 切换为暂停
    if (isAudioPlaying) {
      audioCtx.pause();
      this.setData({ isAudioPlaying: false });
      return;
    }

    // 已暂停但有 src → 继续播放
    if (!isAudioPlaying && audioCtx.src) {
      audioCtx.play();
      this.setData({ isAudioPlaying: true });
      return;
    }

    // 第一次播放，需先下载
    this.setData({ isLoading: true });
    this.clearTempFile(tempAudioPath);

    const newTempPath = `${wx.env.USER_DATA_PATH}/${Date.now()}-audio.mp3`;
    wx.cloud.downloadFile({
      fileID: audioFileID,
      tempFilePath: newTempPath,
      config: { env: "cloud1-1grapwhzb010af67" },
      success: (downloadRes) => {
        try {
          const fs = wx.getFileSystemManager();
          fs.statSync(downloadRes.tempFilePath);

          audioCtx.src = downloadRes.tempFilePath;
          audioCtx.autoplay = false;

          // 监听错误
          audioCtx.offError();
          audioCtx.onError((err) => {
            console.error("伴奏播放错误:", err);
            wx.showToast({ title: "伴奏播放失败", icon: "none" });
            this.setData({ isAudioPlaying: false });
          });

          audioCtx.play();
          this.setData({ 
            isLoading: false,
            isAudioPlaying: true,
            tempAudioPath: downloadRes.tempFilePath
          });
        } catch (err) {
          wx.showToast({ title: "伴奏文件损坏，请重新上传", icon: "none" });
          console.error("伴奏播放错误：", err);
          this.setData({ isLoading: false, isAudioPlaying: false });
        }
      },
      fail: (err) => {
        wx.showToast({ title: "伴奏下载失败", icon: "none" });
        console.error("伴奏下载失败：", err);
        this.setData({ isLoading: false, isAudioPlaying: false });
      }
    });
  },

  // 选择歌词文件
  chooseLyric() {
    wx.chooseMessageFile({
      count: 1,
      type: "file",
      extension: ["txt", "lrc"],
      success: (res) => {
        const tempFile = res.tempFiles[0];
        const fs = wx.getFileSystemManager();
        fs.readFile({
          filePath: tempFile.path,
          encoding: "utf8",
          success: (readRes) => {
            this.updateFolderData({
              lyricContent: readRes.data,
              lyricName: tempFile.name
            });
          },
          fail: (err) => {
            console.error("读取歌词失败：", err);
            wx.showToast({ title: "读取歌词失败", icon: "none" });
          }
        });
      },
      fail: (err) => {
        console.error("选择歌词失败：", err);
        wx.showToast({ title: "选择歌词失败", icon: "none" });
      }
    });
  },

  // 上传文件（音频/录音）
async uploadFile(tempFile, type, recordId = null) {
  this.setData({ isLoading: true });
  try {
    const openid = wx.getStorageSync("openid");
    if (!openid) await this.getUserOpenid();

    let fileName = tempFile.name || `${type}-${Date.now()}`;
    fileName = fileName.replace(/[\\/:*?"<>| ]/g, "_");
    const cloudPath = `${type}/${openid}/${Date.now()}-${fileName}`;

    wx.showLoading({
      title: `正在上传...`,
      mask: true
    });

    const uploadRes = await wx.cloud.uploadFile({
      cloudPath: cloudPath,
      filePath: tempFile.path,
      config: { env: "cloud1-1grapwhzb010af67" }
    });

    wx.hideLoading();

    if (!uploadRes.fileID || !uploadRes.fileID.startsWith("cloud://")) {
      throw new Error("上传失败，未获取到有效文件ID");
    }

    // 验证云端文件是否可下载
    try {
      const testDownload = await wx.cloud.downloadFile({
        fileID: uploadRes.fileID,
        config: { env: "cloud1-1grapwhzb010af67" }
      });
      if (!testDownload.tempFilePath) {
        throw new Error("文件上传成功但无法下载");
      }
    } catch (verifyErr) {
      console.error("文件验证失败，尝试重新删除云端文件:", verifyErr);
      await wx.cloud.deleteFile({
        fileList: [uploadRes.fileID],
        config: { env: "cloud1-1grapwhzb010af67" }
      });
      throw new Error("文件上传后验证失败，请重试");
    }

    if (type === "audio") {
      // 伴奏
      await this.updateFolderData({
        audioFileID: uploadRes.fileID,
        audioName: tempFile.name,
        audioSize: Math.floor(tempFile.size / 1024)
      });
      wx.showToast({ title: "伴奏上传成功" });
    } else if (type === "record") {
      // 录音：上传完成后回填 fileID
      const updatedRecords = this.data.recordList.map(r => {
        if (r.recordId === recordId) {
          return { ...r, fileID: uploadRes.fileID };
        }
        return r;
      });

      this.setData({ recordList: updatedRecords });
      await this.updateFolderData({ recordList: updatedRecords });
      wx.showToast({ title: "录音保存成功" });
    }

  } catch (err) {
    wx.hideLoading();
    wx.showToast({ title: `上传失败：${err.message}`, icon: "none" });
    console.error(`${type}文件上传错误：`, err);
  } finally {
    this.setData({ isLoading: false });
  }
},

  // 更新文件夹数据到数据库
  async updateFolderData(updateData) {
    // 优化：减少不必要的重渲染
    this.setData({ isLoading: true });
    try {
      const { folderId } = this.data;
      if (!folderId.trim()) {
        throw new Error("文件夹ID无效，无法更新数据");
      }

      // 优化：先在本地更新数据，再同步到云端
      const localUpdates = {};
      if (updateData.videoList) {
        localUpdates.videoList = updateData.videoList;
      }
      if (updateData.recordList) {
        localUpdates.recordList = updateData.recordList;
      }
      if (updateData.audioFileID !== undefined) {
        localUpdates.audioFileID = updateData.audioFileID;
        localUpdates.audioName = updateData.audioName;
        localUpdates.audioSize = updateData.audioSize;
      }
      if (updateData.lyricContent !== undefined) {
        localUpdates.lyricContent = updateData.lyricContent;
        localUpdates.lyricLines = updateData.lyricContent.split("\n") || [];
      }
      
      // 先更新本地数据，提升响应速度
      this.setData(localUpdates);

      // 再同步到数据库
      const res = await folderCol.doc(folderId.trim()).update({
        data: updateData,
        config: { env: "cloud1-1grapwhzb010af67" }
      });

      if (res.stats && res.stats.updated === 1) {
        console.log("文件夹数据更新成功");
      } else {
        console.warn("文件夹数据未实际更新", res);
        // 回滚本地更新
        this.loadFolderData();
      }
    } catch (err) {
      console.error("更新文件夹数据失败：", err);
      // 回滚本地更新
      this.loadFolderData();
      throw new Error("保存失败，请检查网络后重试");
    } finally {
      this.setData({ isLoading: false });
    }
  },

  // 停止播放录音
  stopPlayRecording() {
    // 优先使用录音播放器（回退到伴奏播放器以防万一）
    const ctx = this.data.recordAudioCtx || this.data.audioCtx;
    const { currentPlayRecord, recordList } = this.data;
  
    try {
      if (ctx && currentPlayRecord && !isNaN(ctx.currentTime)) {
        const updatedRecords = recordList.map(item => {
          if (item.recordId === currentPlayRecord) {
            return {
              ...item,
              progressPercent: item.progressPercent,
              currentTime: Math.floor(ctx.currentTime),
              totalDuration: ctx.duration || item.totalDuration
            };
          }
          return item;
        });
        this.setData({ recordList: updatedRecords });
      }
  
      if (ctx && typeof ctx.stop === 'function') {
        try { ctx.stop(); } catch (e) { console.warn('停止播放出错：', e); }
      }
  
      if (ctx) {
        if (typeof ctx.offCanplay === 'function') ctx.offCanplay();
        if (typeof ctx.offError === 'function') ctx.offError();
        if (typeof ctx.offTimeUpdate === 'function') ctx.offTimeUpdate();
        if (typeof ctx.offEnded === 'function') ctx.offEnded();
      }
  
      this.clearTempFile(this.data.tempRecordPath);
  
      this.setData({
        isRecordPlaying: false,
        isAudioPlaying: false,
        currentPlayRecord: null
      });
    } catch (err) {
      console.error('stopPlayRecording执行出错:', err);
    }
  },
  

  // 删除单个录音
  async deleteRecording(e) {
    // 获取当前要删除的录音信息
    const record = e.currentTarget.dataset.record;
    if (!record || !record.recordId || !record.fileID) {
      wx.showToast({ title: "录音信息无效", icon: "none" });
      return;
    }

    wx.showModal({
      title: "确认删除",
      content: `确定要删除录音「${record.name || '未命名'}」吗？此操作不可恢复。`,
      cancelText: "取消",
      confirmText: "删除",
      confirmColor: "#ff3b30",
      success: async (res) => {
        if (res.confirm) {
          try {
            this.setData({ isLoading: true });
            
            // 1. 先删除云端文件
            await wx.cloud.deleteFile({
              fileList: [record.fileID],
              config: { env: "cloud1-1grapwhzb010af67" }
            });
            
            // 2. 过滤掉要删除的录音，更新本地列表
            const updatedRecords = this.data.recordList.filter(
              item => item.recordId !== record.recordId
            );
            
            // 3. 如果删除的是正在播放的录音，停止播放并清理状态
            if (this.data.currentPlayRecord === record.recordId) {
              this.stopPlayRecording();
            }
            
            // 4. 更新数据库
            await this.updateFolderData({
              recordList: updatedRecords
            });
            
            wx.showToast({ title: "录音已删除" });
          } catch (err) {
            console.error("删除录音失败：", err);
            let errorMsg = "删除失败，请重试";
            if (err.message.includes("permission")) {
              errorMsg = "没有删除权限权限";
            } else if (err.message.includes("not found")) {
              errorMsg = "文件不存在";
            }
            wx.showToast({ title: errorMsg, icon: "none" });
          } finally {
            this.setData({ isLoading: false });
          }
        }
      }
    });
  },

  navigateToVideoPlay(e) {
    const video = e.currentTarget.dataset.video;
    if (!video || !video.videoId) {
      wx.showToast({ title: "视频信息无效", icon: "none" });
      return;
    }
  
    // 处理不同平台的播放参数
    let playParams = {};
    
    // B站视频特殊处理
    if (video.platform === 'bilibili') {
      playParams = {
        webPlayUrl: `https://www.bilibili.com/video/${video.videoId}?autoplay=0`,
        realPlayUrl: '' // B站不支持直接播放
      };
    } 
    // 抖音视频特殊处理
    else if (video.platform === 'douyin') {
      playParams = {
        webPlayUrl: video.webUrl.includes('?') ? 
          `${video.webUrl}&autoplay=0` : 
          `${video.webUrl}?autoplay=0`,
        realPlayUrl: '' // 抖音不支持直接播放
      };
    }
    // 其他视频（MP4等直链）
    else {
      playParams = {
        webPlayUrl: '',
        realPlayUrl: video.realPlayUrl || video.webUrl
      };
    }
  
    // 合并视频信息
    const videoData = {
      ...video,
      ...playParams
    };
  
    // 跳转到通用播放页
    wx.navigateTo({
      url: `/pages/videoPlay/videoPlay?video=${encodeURIComponent(JSON.stringify(videoData))}`,
      fail: (err) => {
        console.error("跳转失败:", err);
        // 备用方案：复制链接
        wx.setClipboardData({
          data: video.webUrl || video.realPlayUrl,
          success: () => {
            wx.showToast({ title: "链接已复制", icon: "none" });
          }
        });
      }
    });
  },

  // 删除视频
  async deleteVideo(e) {
    const videoId = e.currentTarget.dataset.videoid;
    if (!videoId) {
      wx.showToast({ title: "视频ID无效", icon: "none" });
      return;
    }

    wx.showModal({
      title: "确认删除",
      content: "确定要删除这个视频吗？此操作不可恢复。",
      cancelText: "取消",
      confirmText: "删除",
      confirmColor: "#ff3b30",
      success: async (res) => {
        if (res.confirm) {
          try {
            this.setData({ isLoading: true });
            
            // 从列表中移除视频
            const updatedVideos = this.data.videoList.filter(
              video => video.videoId !== videoId
            );
            
            // 更新数据库
            await this.updateFolderData({
              videoList: updatedVideos
            });
            
            wx.showToast({ title: "视频已删除" });
          } catch (err) {
            console.error("删除视频失败:", err);
            wx.showToast({ title: "删除失败，请重试", icon: "none" });
          } finally {
            this.setData({ isLoading: false });
          }
        }
      }
    });
  },
  // 清理临时文件的方法
clearTempFile(filePath) {
  if (!filePath) return;
  
  try {
    // 检查是否是HTTP URL或wxfile:// URL，如果是则不进行文件系统操作
    if (filePath.startsWith('http://') || filePath.startsWith('https://') || filePath.startsWith('wxfile://')) {
      console.log('跳过HTTP或wxfile URL文件清理:', filePath);
      return;
    }
    
    const fs = wx.getFileSystemManager();
    // 检查文件是否存在
    try {
      fs.accessSync(filePath);
      // 删除文件
      fs.unlinkSync(filePath);
      console.log('清理临时文件:', filePath);
    } catch (accessErr) {
      // 文件不存在，不报错
      console.log('文件不存在，无需清理:', filePath);
    }
  } catch (err) {
    // 其他错误，仅记录不抛出
    console.log('清理文件过程中出现错误:', err.message);
  }
},  

  // 启动备用进度更新定时器（防止onTimeUpdate事件不触发）
  startBackupProgressTimer(recordId, audioCtx) {
    // 先清除之前的定时器
    this.stopBackupProgressTimer();
    
    // 创建新的定时器，每100毫秒更新一次进度
    const timer = setInterval(() => {
      try {
        const { isDragging, isRecordPlaying } = this.data;
        if (!isDragging && isRecordPlaying && audioCtx && !isNaN(audioCtx.currentTime) && !isNaN(audioCtx.duration)) {
          this.updateRecordingProgress(
            recordId,
            audioCtx.currentTime,
            audioCtx.duration
          );
        } else if (!isRecordPlaying) {
          // 如果录音已停止，清除定时器
          this.stopBackupProgressTimer();
        }
      } catch (err) {
        console.warn('备用进度更新失败:', err);
        // 出错时停止定时器
        this.stopBackupProgressTimer();
      }
    }, 100);
    
    this.setData({ playProgressTimer: timer });
  },
  
  // 停止备用进度更新定时器
  stopBackupProgressTimer() {
    if (this.data.playProgressTimer) {
      clearInterval(this.data.playProgressTimer);
      this.setData({ playProgressTimer: null });
    }
  },

  getDefaultCover(platform) {
    switch (platform) {
      case 'bilibili':
        return '/images/bilibili-cover.png';
      case 'douyin':
        return '/images/douyin-cover.png';
      case 'tencent':
        return '/images/tencent-cover.png';
      default:
        return '/images/default-cover.png';
    }
  },

  // 页面卸载时清理所有资源
  onUnload() {
    console.log('页面卸载，清理所有资源');
    
    // 停止录音播放
    try {
      this.stopPlayRecording();
    } catch (err) {
      console.warn('停止录音播放时出错:', err);
    }
    
    // 清除录音计时器
    this.clearRecordTimer();
    
    // 停止备用进度更新定时器
    this.stopBackupProgressTimer();
    
    // 清理音频上下文
    if (this.data.recordAudioCtx) {
      try {
        if (typeof this.data.recordAudioCtx.stop === 'function') {
          this.data.recordAudioCtx.stop();
        }
        if (typeof this.data.recordAudioCtx.destroy === 'function') {
          this.data.recordAudioCtx.destroy();
        }
      } catch (err) {
        console.warn('销毁录音播放器时出错:', err);
      }
    }
    
    if (this.data.audioCtx) {
      try {
        if (typeof this.data.audioCtx.stop === 'function') {
          this.data.audioCtx.stop();
        }
        if (typeof this.data.audioCtx.destroy === 'function') {
          this.data.audioCtx.destroy();
        }
      } catch (err) {
        console.warn('销毁伴奏播放器时出错:', err);
      }
    }
    
    // 清理临时文件
    this.clearTempFile(this.data.tempAudioPath);
    this.clearTempFile(this.data.tempRecordPath);
  }
});