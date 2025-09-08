// 初始化云开发
wx.cloud.init({
  env: "cloud1-1grapwhzb010af67"
});
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
    recordTimeDisplay: "00:00",
    currentPlayRecord: null,
    isLoading: false,
    tempAudioPath: "",
    tempRecordPath: "",
    // 进度条相关状态
    isPlaying: false,   // 播放状态
    currentTime: 0,     // 当前播放时间（秒）
    totalPlayTime: 0,   // 总时长（秒）
    progressPercent: 0, // 进度条百分比（0-100）
    audioCtx: null,     // 音频上下文实例
    isDragging: false,  // 是否正在拖动进度条
    handleTimeUpdate: null, // 存储时间更新回调，用于销毁
    playProgressTimer: null // 备用进度定时器
  },

  onLoad(options) {
    // 初始化音频上下文
    const audioCtx = wx.createInnerAudioContext();
    this.setData({ audioCtx }, () => {
      audioCtx.stop();
      audioCtx.src = "";
    });

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
      this.initAudioPlayer();
    }).catch(err => {
      console.error("用户信息获取失败：", err);
      wx.showToast({ title: "登录失败，请重试", icon: "none" });
      setTimeout(() => wx.navigateBack(), 1500);
    });
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
        name: "login",
        config: { env: "cloud1-1grapwhzb010af67" }
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

  // 格式化创建时间
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
      return '无效时间';
    }
    
    // 检查是否为有效日期
    if (isNaN(date.getTime())) return '无效时间';
    
    // 格式化显示
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
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

    this.setData({ isLoading: true });
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
          // 格式化创建时间
          const formattedCreateTime = this.formatCreateTime(record.createTime);
          
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
          createTime: data.createTime || db.serverDate()
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

  // 播放录音
  async playRecording(e) {
    const record = e.currentTarget.dataset.record;
    if (!record || !record.fileID) {
      wx.showToast({ title: "录音信息无效", icon: "none" });
      return;
    }
    
    const { currentPlayRecord, tempRecordPath, audioCtx, recordList } = this.data;
    
    if (!audioCtx) {
      wx.showToast({ title: "播放器初始化中", icon: "none" });
      return;
    }
    
    // 如果正在播放当前录音，点击则暂停
    if (currentPlayRecord === record.recordId) {
      if (audioCtx.paused) {
        audioCtx.play();
        this.setData({ isAudioPlaying: true });
      } else {
        audioCtx.pause();
        this.setData({ isAudioPlaying: false });
      }
      return;
    }
    
    // 停止其他录音播放
    if (currentPlayRecord) {
      this.stopPlayRecording();
    }
    
    this.setData({ isLoading: true });
    
    try {
      // 清理旧的录音临时文件
      this.clearTempFile(tempRecordPath);
      
      // 下载录音文件
      const newTempPath = `${wx.env.USER_DATA_PATH}/${Date.now()}-record.mp3`;
      const downloadRes = await wx.cloud.downloadFile({
        fileID: record.fileID,
        tempFilePath: newTempPath,
        config: { env: "cloud1-1grapwhzb010af67" }
      });
      
      // 验证文件
      const fs = wx.getFileSystemManager();
      const fileStat = fs.statSync(downloadRes.tempFilePath);
      if (fileStat.size < 1024) throw new Error("录音文件损坏或过小");
      
      // 更新当前播放录音的进度信息
      const updatedRecords = recordList.map(item => {
        if (item.recordId === record.recordId) {
          return {
            ...item,
            progressPercent: 0,
            currentTime: 0
          };
        }
        return item;
      });
      
      // 设置音频源
      audioCtx.src = downloadRes.tempFilePath;
      
      // 监听播放状态
      return new Promise((resolve) => {
        const canplayHandler = () => {
          audioCtx.offCanplay(canplayHandler);
          audioCtx.play();
          
          // 存储总时长到录音对象中
          const withDurationRecords = updatedRecords.map(item => {
            if (item.recordId === record.recordId) {
              return {
                ...item,
                totalDuration: audioCtx.duration // 存储总时长
              };
            }
            return item;
          });
          
          this.setData({
            currentPlayRecord: record.recordId,
            tempRecordPath: downloadRes.tempFilePath,
            isLoading: false,
            isAudioPlaying: true,
            recordList: withDurationRecords
          });
          resolve();
        };
        
        const errorHandler = (err) => {
          audioCtx.offError(errorHandler);
          throw new Error(`录音播放错误：${err.errMsg}`);
        };
        
        audioCtx.onCanplay(canplayHandler);
        audioCtx.onError(errorHandler);
      });
      
    } catch (err) {
      this.setData({ isLoading: false });
      console.error("播放录音失败：", err);
      wx.showToast({ title: `播放失败：${err.message}`, icon: "none" });
      this.clearTempFile(newTempPath);
    }
  },

  // 更新录音进度
  updateRecordingProgress(recordId, currentTime, duration) {
    const { recordList } = this.data;
    if (!recordId || !recordList.length) return;
    
    const progressPercent = duration > 0 ? Math.min(Math.floor((currentTime / duration) * 100), 100) : 0;
    
    // 更新对应录音的进度
    const updatedRecords = recordList.map(item => {
      if (item.recordId === recordId) {
        return {
          ...item,
          progressPercent,
          currentTime: Math.floor(currentTime)
        };
      }
      return item;
    });
    
    this.setData({ recordList: updatedRecords });
  },

  // 初始化音频播放器 - 重点修复进度更新逻辑
  initAudioPlayer() {
    const { audioCtx } = this.data;
    if (!audioCtx) return;

    // 移除旧的时间监听（避免重复绑定）
    if (this.data.handleTimeUpdate) {
      audioCtx.offTimeUpdate(this.data.handleTimeUpdate);
    }

    // 音频错误处理
    audioCtx.onError(err => {
      console.error("音频播放错误详情：", err);
      this.setData({ 
        isAudioPlaying: false, 
        currentPlayRecord: null
      });

      let errorMsg = "播放失败";
      switch (err.errCode) {
        case 10001: errorMsg = "音频文件无效"; break;
        case 10002: errorMsg = "网络错误（文件下载失败）"; break;
        case 10003: errorMsg = "格式不支持（仅MP3/WAV/AAC）"; break;
        case 10004: errorMsg = "文件已删除或路径无效"; break;
        default: errorMsg = `错误码：${err.errCode}`;
      }
      wx.showToast({ title: errorMsg, icon: "none" });
    });

    // 音频播放结束处理
    audioCtx.onEnded(() => {
      const { currentPlayRecord } = this.data;
      
      // 重置当前播放录音的进度
      const updatedRecords = this.data.recordList.map(item => {
        if (item.recordId === currentPlayRecord) {
          return {
            ...item,
            progressPercent: 0,
            currentTime: 0
          };
        }
        return item;
      });
      
      this.setData({
        isAudioPlaying: false, 
        currentPlayRecord: null,
        recordList: updatedRecords
      });
      this.clearTempFile(this.data.tempRecordPath);
    });

    // 核心：时间更新监听（实时更新进度条）
    const handleTimeUpdate = () => {
      const { isAudioPlaying, isDragging, currentPlayRecord } = this.data;
      // 播放中、未拖动、有当前播放录音、时长有效时更新进度
      if (isAudioPlaying && !isDragging && currentPlayRecord && !isNaN(audioCtx.duration)) {
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
    if (!recordId) return;
    
    const { audioCtx } = this.data;
    if (audioCtx && !audioCtx.paused) {
      audioCtx.pause(); // 拖动时暂停播放
      this.setData({ isAudioPlaying: false });
    }
    this.setData({ isDragging: true });
  },

  // 进度条拖动中（实时更新显示）
  onProgressTouchMove(e) {
    const recordId = e.currentTarget.dataset.recordid;
    if (!recordId || !e.touches || e.touches.length === 0) {
      console.warn("无效的进度条拖动事件数据");
      return;
    }
    
    // 获取进度条容器的位置和宽度
    const query = wx.createSelectorQuery().in(this);
    query.select(`.progress-wrap[data-recordid="${recordId}"]`).boundingClientRect();
    query.exec((res) => {
      if (!res || !res[0]) return;
      
      const progressWrap = res[0];
      const wrapLeft = progressWrap.left;
      const wrapWidth = progressWrap.width;
      
      // 计算触摸位置在进度条上的百分比
      let touchX = e.touches[0].clientX;
      // 限制在进度条范围内
      touchX = Math.max(touchX, wrapLeft);
      touchX = Math.min(touchX, wrapLeft + wrapWidth);
      
      // 计算百分比
      const percent = Math.round(((touchX - wrapLeft) / wrapWidth) * 100);
      
      // 更新对应录音的进度显示
      const updatedRecords = this.data.recordList.map(item => {
        if (item.recordId === recordId) {
          return {
            ...item,
            progressPercent: percent
          };
        }
        return item;
      });
      this.setData({ recordList: updatedRecords });
    });
  },

  // 进度条拖动结束（跳转到指定进度）
  onProgressTouchEnd(e) {
    const recordId = e.currentTarget.dataset.recordid;
    const { audioCtx, isAudioPlaying, recordList } = this.data;
    
    if (!audioCtx || !recordId) return;
    
    // 获取进度条容器的位置和宽度
    const query = wx.createSelectorQuery().in(this);
    query.select(`.progress-wrap[data-recordid="${recordId}"]`).boundingClientRect();
    query.exec((res) => {
      if (!res || !res[0]) {
        this.setData({ isDragging: false });
        return;
      }
      
      const progressWrap = res[0];
      const wrapLeft = progressWrap.left;
      const wrapWidth = progressWrap.width;
      
      // 计算触摸位置在进度条上的百分比
      let touchX = e.changedTouches[0].clientX;
      // 限制在进度条范围内
      touchX = Math.max(touchX, wrapLeft);
      touchX = Math.min(touchX, wrapLeft + wrapWidth);
      
      // 计算百分比
      const percent = Math.round(((touchX - wrapLeft) / wrapWidth) * 100);
      
      // 找到当前录音
      const record = recordList.find(item => item.recordId === recordId);
      if (!record) {
        this.setData({ isDragging: false });
        return;
      }
      
      // 计算目标时间并更新进度
      if (!isNaN(audioCtx.duration)) {
        const targetTime = Math.min((percent / 100) * audioCtx.duration, audioCtx.duration);
        audioCtx.currentTime = targetTime;
        this.updateRecordingProgress(recordId, targetTime, audioCtx.duration);
        
        // 恢复播放状态
        if (isAudioPlaying) {
          const errorHandler = (err) => {
            console.error("拖动后播放错误：", err);
            wx.showToast({ title: "播放失败", icon: "none" });
            audioCtx.offError(errorHandler);
          };
          audioCtx.onError(errorHandler);
          audioCtx.play();
          this.setData({ isAudioPlaying: true });
        }
      }
      
      this.setData({ isDragging: false });
    });
  },

  // 播放/暂停切换
  toggleRecordPlay(e) {
    const recordId = e.currentTarget.dataset.recordid;
    if (!recordId) return;
    
    const { isAudioPlaying, audioCtx, currentPlayRecord } = this.data;
    
    // 确保是当前播放的录音
    if (currentPlayRecord !== recordId) return;
    
    if (!audioCtx) {
      console.warn("音频上下文未初始化");
      wx.showToast({ title: "播放器初始化中，请稍后", icon: "none" });
      return;
    }
  
    if (isAudioPlaying) {
      audioCtx.pause();
      this.setData({ isAudioPlaying: false });
    } else {
      audioCtx.play();
      const errorHandler = (err) => {
        console.error("播放错误：", err);
        wx.showToast({ title: "播放失败，请检查音频文件", icon: "none" });
        this.setData({ isAudioPlaying: false });
        audioCtx.offError(errorHandler);
      };
      audioCtx.onError(errorHandler);
      this.setData({ isAudioPlaying: true });
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
  onUnload() {
    const { audioCtx } = this.data;
    if (this.data.isRecording) recorder.stop();
    if (audioCtx) {
      audioCtx.stop();
      audioCtx.destroy(); // 销毁音频上下文
    }
    if (recordTimer) clearInterval(recordTimer);
    if (this.data.playProgressTimer) clearInterval(this.data.playProgressTimer);
    // 清理临时文件
    this.clearTempFile(this.data.tempAudioPath);
    this.clearTempFile(this.data.tempRecordPath);
  },

  // 清理临时文件
  clearTempFile(filePath) {
    if (!filePath) return;
    
    // 只处理用户数据目录下的文件，避免处理网络路径
    if (!filePath.startsWith(wx.env.USER_DATA_PATH)) {
      console.log("跳过非用户数据目录文件的清理：", filePath);
      return;
    }
    
    const fs = wx.getFileSystemManager();
    try {
      // 先检查文件是否存在
      fs.statSync(filePath);
      // 存在则删除
      fs.unlinkSync(filePath);
      console.log("临时文件清理成功：", filePath);
    } catch (err) {
      // 忽略文件不存在和权限错误
      if (err.message.includes("no such file") || err.message.includes("permission denied")) {
        console.log("文件无需清理（不存在或无权限）：", filePath);
      } else {
        console.warn("临时文件清理失败：", err);
      }
    }
  },

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

    recorder.onError(err => {
      console.error("录音错误详情：", err);
      this.setData({ isRecording: false });
      wx.showToast({ title: `录音失败：${err.message || "未知错误"}`, icon: "none" });
      this.clearRecordTimer();
    });
  },

  // 更新录音时间显示
  updateRecordTime() {
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

    if (currentPlayRecord) {
      audioCtx.stop();
      this.setData({ currentPlayRecord: null });
      this.clearTempFile(this.data.tempRecordPath);
    }

    if (isAudioPlaying) {
      audioCtx.pause();
      this.setData({ isAudioPlaying: false });
      return;
    }

    this.setData({ isLoading: true });
    try {
      this.clearTempFile(tempAudioPath);

      const newTempPath = `${wx.env.USER_DATA_PATH}/${Date.now()}-audio.mp3`;
      wx.cloud.downloadFile({
        fileID: audioFileID,
        tempFilePath: newTempPath,
        config: { env: "cloud1-1grapwhzb010af67" },
        success: (downloadRes) => {
          const fs = wx.getFileSystemManager();
          try {
            fs.statSync(downloadRes.tempFilePath);
            audioCtx.src = downloadRes.tempFilePath;
            audioCtx.autoplay = false;
            audioCtx.play();
            
            this.setData({ 
              isLoading: false,
              isAudioPlaying: true,
              tempAudioPath: downloadRes.tempFilePath
            });
          } catch (err) {
            throw new Error("伴奏文件下载失败或损坏");
          }
        },
        fail: (err) => {
          throw new Error("伴奏下载失败：" + err.message);
        }
      });
    } catch (err) {
      this.setData({ isLoading: false, isAudioPlaying: false });
      let errorMsg = "伴奏播放失败";
      if (err.message.includes("NotSupported")) errorMsg = "不支持的音频格式（仅MP3/WAV/AAC）";
      else if (err.message.includes("downloadFile:fail")) errorMsg = "伴奏下载失败（网络或文件ID错误）";
      else if (err.message.includes("损坏")) errorMsg = "伴奏文件损坏，请重新上传";
      wx.showToast({ title: errorMsg, icon: "none" });
      console.error("伴奏播放错误：", err);
    }
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
  async uploadFile(tempFile, type) {
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
        config: { env: "cloud1-1grapwhzb010af67" },
        onUploadProgress: (progressEvent) => {
          const percent = Math.round((progressEvent.loaded / progressEvent.total) * 100);
          console.log(`上传进度: ${percent}%`);
        }
      });

      wx.hideLoading();

      if (!uploadRes.fileID || !uploadRes.fileID.startsWith("cloud://")) {
        throw new Error("上传失败，未获取到有效文件ID");
      }

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
        await this.updateFolderData({
          audioFileID: uploadRes.fileID,
          audioName: tempFile.name,
          audioSize: Math.floor(tempFile.size / 1024)
        });
        wx.showToast({ title: "伴奏上传成功" });
      } else if (type === "record") {
        const newRecord = {
          recordId: Date.now().toString(),
          fileID: uploadRes.fileID,
          createTime: db.serverDate(),
          duration: recordSeconds,
          name: `录音-${this.data.recordTimeDisplay}`
        };
        
        // 处理新录音的时长和时间格式
        const durationFromName = this.extractDurationFromName(newRecord.name);
        const formattedCreateTime = this.formatCreateTime(newRecord.createTime);
        newRecord.durationFromName = durationFromName;
        newRecord.formattedCreateTime = formattedCreateTime;
        newRecord.progressPercent = 0;
        newRecord.currentTime = 0;
        
        const currentRecordList = [...this.data.recordList];
        currentRecordList.push(newRecord);
        
        this.setData({ recordList: currentRecordList });
        await this.updateFolderData({ recordList: currentRecordList });
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
    this.setData({ isLoading: true });
    try {
      const { folderId } = this.data;
      if (!folderId.trim()) {
        throw new Error("文件夹ID无效，无法更新数据");
      }

      const res = await folderCol.doc(folderId.trim()).update({
        data: updateData,
        config: { env: "cloud1-1grapwhzb010af67" }
      });

      if (res.stats.updated === 0) {
        throw new Error("数据更新失败，可能无权限或数据未变化");
      }

      this.loadFolderData();
    } catch (err) {
      wx.showToast({ title: "数据库更新失败", icon: "none" });
      console.error("数据库错误：", err);
    } finally {
      this.setData({ isLoading: false });
    }
  },

  // 停止播放录音
  stopPlayRecording() {
    const { audioCtx, currentPlayRecord, recordList } = this.data;
    if (audioCtx) audioCtx.stop();
    
    // 重置当前播放录音的进度
    const updatedRecords = recordList.map(item => {
      if (item.recordId === currentPlayRecord) {
        return {
          ...item,
          progressPercent: 0,
          currentTime: 0
        };
      }
      return item;
    });
    
    this.setData({
      currentPlayRecord: null,
      isAudioPlaying: false,
      recordList: updatedRecords
    });
    this.clearTempFile(this.data.tempRecordPath);
  },

  // 删除录音
  deleteRecording(e) {
    const recordingId = e.currentTarget.dataset.recordingid;
    const fileID = e.currentTarget.dataset.fileid;
    const { recordList, currentPlayRecord, audioCtx } = this.data;
    
    // 查找要删除的录音
    const recordIndex = recordList.findIndex(item => item.recordId === recordingId);
    if (recordIndex === -1) {
      wx.showToast({ title: "录音不存在或已删除", icon: "none" });
      return;
    }
    
    wx.showModal({
      title: "确认删除",
      content: "确定要删除这条录音吗？删除后无法恢复（包含云端文件）。",
      confirmText: "删除",
      confirmColor: "#F44336",
      cancelText: "取消",
      success: async (res) => {
        if (!res.confirm) return;
        
        this.setData({ isLoading: true });
        
        try {
          // 1. 停止当前播放的录音
          if (currentPlayRecord === recordingId && audioCtx) {
            audioCtx.stop();
            this.setData({
              currentPlayRecord: null,
              isAudioPlaying: false,
              tempRecordPath: ""
            });
          }
          
          // 2. 删除云端文件（如果有fileID）
          if (fileID && fileID.startsWith("cloud://")) {
            const deleteRes = await wx.cloud.deleteFile({
              fileList: [fileID],
              config: { env: "cloud1-1grapwhzb010af67" }
            });
            
            // 检查删除结果，允许个别情况
            const failItems = deleteRes.fileList.filter(item => item.status !== 0);
            if (failItems.length > 0) {
              console.warn("云端文件删除警告：", failItems[0].errMsg);
            }
          }
          
          // 3. 更新本地列表
          const newRecordList = [...recordList];
          newRecordList.splice(recordIndex, 1);
          
          // 4. 同步更新数据库
          await this.updateFolderData({ recordList: newRecordList });
          
          // 5. 刷新页面状态
          this.setData({ recordList: newRecordList });
          wx.showToast({ title: "录音删除成功", icon: "success" });
          
        } catch (err) {
          console.error("删除录音失败：", err);
          // 即使云端删除失败，也更新本地列表
          const newRecordList = recordList.filter(item => item.recordId !== recordingId);
          this.setData({ recordList: newRecordList });
          wx.showToast({ title: `删除失败：${err.message}`, icon: "none" });
        } finally {
          this.setData({ isLoading: false });
        }
      }
    });
  },

  // 视频错误处理
  onVideoError(e) {
    console.error("视频错误：", e.detail.errMsg);
    wx.showToast({ title: "视频错误：" + e.detail.errMsg, icon: "none" });
  },

  // 录音播放错误处理
  onRecordError(e) {
    console.error("录音播放错误：", e.detail.errMsg);
    wx.showToast({ title: "录音播放错误：" + e.detail.errMsg, icon: "none" });
  },

  // 删除伴奏
  deleteAudio() {
    wx.showModal({
      title: "确认删除",
      content: "删除后伴奏将无法恢复，是否继续？",
      confirmText: "删除",
      confirmColor: "#F44336",
      success: async (res) => {
        if (res.confirm) {
          this.setData({ isLoading: true });
          try {
            const { audioFileID } = this.data;
            if (audioFileID) {
              await wx.cloud.deleteFile({
                fileList: [audioFileID],
                config: { env: "cloud1-1grapwhzb010af67" }
              });
            }
            await this.updateFolderData({
              audioFileID: "",
              audioName: "",
              audioSize: 0
            });
            wx.showToast({ title: "伴奏删除成功" });
          } catch (err) {
            wx.showToast({ title: "删除失败：" + err.message, icon: "none" });
            console.error("删除伴奏错误：", err);
          } finally {
            this.setData({ isLoading: false });
          }
        }
      }
    });
  },

  // 显示添加视频URL对话框
  showVideoUrlDialog() {
    this.setData({ 
      showVideoUrlDialog: true,
      videoUrl: ""
    });
  },

  // 隐藏添加视频URL对话框
  hideVideoUrlDialog() {
    this.setData({ showVideoUrlDialog: false });
  },

  // 视频URL输入
  onVideoUrlInput(e) {
    this.setData({ videoUrl: e.detail.value });
  },

  // 验证视频URL有效性
  isValidVideoUrl(url) {
    if (!url.trim()) return false;
    const trimmedUrl = url.trim();
    
    const validRegex = [
      /^https?:\/\/(www\.)?bilibili\.com\/video\/BV[a-zA-Z0-9]+/,
      /^https?:\/\/.+\.(mp4|mov|avi|flv)/i,
      /^https?:\/\/(v\.qq\.com|youku\.com|iqiyi\.com)\/.+/i
    ];
    
    return validRegex.some(regex => regex.test(trimmedUrl));
  },

  // 处理视频URL（适配不同平台）
  processVideoUrl(url) {
    const trimmedUrl = url.trim();
    const bvMatch = trimmedUrl.match(/BV[a-zA-Z0-9]+/);
    
    if (bvMatch && bvMatch[0]) {
      return `https://player.bilibili.com/player.html?bvid=${bvMatch[0]}&page=1`;
    }
    
    return trimmedUrl;
  },

  // 确认添加视频
  confirmAddVideo() {
    const { videoUrl, videoList } = this.data;
    
    if (!this.isValidVideoUrl(videoUrl)) {
      wx.showToast({ 
        title: "请输入有效视频链接", 
        icon: "none",
        duration: 2000
      });
      return;
    }

    const processedUrl = this.processVideoUrl(videoUrl);
    const platform = videoUrl.includes("bilibili.com") ? "bilibili" : "other";
    const newVideo = {
      videoId: Date.now().toString(),
      originalUrl: videoUrl,
      playUrl: processedUrl,
      platform: platform,
      addTime: db.serverDate()
    };

    const newVideoList = [...videoList, newVideo];
    this.updateFolderData({ videoList: newVideoList });
    this.hideVideoUrlDialog();
    wx.showToast({ title: "视频添加成功", icon: "success" });
  },

  // 删除视频
  deleteVideo(e) {
    const videoId = e.currentTarget.dataset.vid;
    const newVideoList = this.data.videoList.filter(item => item.videoId !== videoId);
    this.updateFolderData({ videoList: newVideoList });
  },

  // 删除歌词
  deleteLyric() {
    wx.showModal({
      title: "确认删除",
      content: "删除后歌词将无法恢复，是否继续？",
      confirmText: "删除",
      confirmColor: "#F44336",
      success: async (res) => {
        if (res.confirm) {
          await this.updateFolderData({
            lyricContent: "",
            lyricLines: []
          });
          wx.showToast({ title: "歌词删除成功" });
        }
      }
    });
  },

  // 伴唱模式（音频+视频同步播放）
  async playWithAudio(e) {
    const videoId = e.currentTarget.dataset.vid;
    const video = this.data.videoList.find(item => item.videoId === videoId);
    const { audioCtx } = this.data;
    
    if (!video) {
      wx.showToast({ title: "视频不存在", icon: "none" });
      return;
    }

    if (audioCtx) {
      audioCtx.stop();
    }
    this.setData({ 
      isAudioPlaying: false,
      currentPlayRecord: null 
    });

    try {
      await this.downloadAndPlayAudio(this.data.audioFileID);
      this.setData({ isAudioPlaying: true });
      
      wx.navigateTo({
        url: `/pages/videoPlayer/videoPlayer?videoUrl=${encodeURIComponent(video.playUrl)}&platform=${video.platform}&playAudio=1`
      });
    } catch (err) {
      console.error("伴唱模式启动失败：", err);
      wx.showToast({ title: "无法启动伴唱模式", icon: "none" });
    }
  },

  // 格式化日期时间
  formatDateTime(time) {
    if (!time) return "未知时间";
    
    // 处理云数据库的时间格式（_seconds）
    if (time._seconds) {
      time = new Date(time._seconds * 1000);
    } else if (!(time instanceof Date)) {
      time = new Date(time);
    }
    
    // 处理无效日期
    if (isNaN(time.getTime())) return "无效时间";
    
    return `${time.getFullYear()}-${(time.getMonth() + 1).toString().padStart(2, '0')}-${time.getDate().toString().padStart(2, '0')} ${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;
  },

  // 下载并播放音频（用于伴唱模式）
  async downloadAndPlayAudio(fileID) {
    const { audioCtx } = this.data;
    if (!audioCtx) throw new Error("音频上下文未初始化");
    
    const tempFilePath = `${wx.env.USER_DATA_PATH}/${Date.now()}-temp-audio.mp3`;
    try {
      // 先清理旧的临时文件
      this.clearTempFile(this.data.tempAudioPath);
      
      // 下载伴奏文件
      const downloadRes = await wx.cloud.downloadFile({
        fileID: fileID,
        tempFilePath: tempFilePath,
        config: { env: "cloud1-1grapwhzb010af67" }
      });

      // 验证文件是否存在
      const fs = wx.getFileSystemManager();
      const fileStat = fs.statSync(downloadRes.tempFilePath);
      if (fileStat.size < 1024) throw new Error("伴奏文件过小，可能损坏");

      // 设置音频源
      audioCtx.src = downloadRes.tempFilePath;
      
      return new Promise((resolve, reject) => {
        // 监听音频可播放事件
        const canplayHandler = () => {
          audioCtx.offCanplay(canplayHandler);
          audioCtx.play();
          resolve(downloadRes.tempFilePath);
        };
        
        // 监听错误事件
        const errorHandler = (err) => {
          audioCtx.offError(errorHandler);
          reject(new Error(`伴奏播放错误：${err.errMsg}`));
        };
        
        audioCtx.onCanplay(canplayHandler);
        audioCtx.onError(errorHandler);
      });
    } catch (err) {
      this.clearTempFile(tempFilePath);
      throw err;
    }
  },

  // 开始录音
  startRecord() {
    const { audioFileID, audioCtx } = this.data;
    
    if (!audioCtx) {
      wx.showToast({ title: "播放器初始化中", icon: "none" });
      return;
    }
    
    if (!audioFileID) {
      wx.showToast({ title: "请先添加伴奏", icon: "none" });
      return;
    }

    if (this.data.currentPlayRecord) {
      audioCtx.stop();
      this.setData({ currentPlayRecord: null });
    }

    this.setData({ isLoading: true });
    
    this.downloadAndPlayAudio(audioFileID).then(() => {
      this.setData({ isLoading: false });
      recorder.start(RECORD_OPTIONS);
      this.setData({ isRecording: true });
      wx.showToast({ title: "录音中...", icon: "none" });
    }).catch(err => {
      this.setData({ isLoading: false, isRecording: false });
      console.error("伴奏加载失败：", err);
      wx.showToast({ title: "伴奏无法播放，无法录音", icon: "none" });
    });
  },

  // 停止录音
  stopRecording() {
    if (!this.data.isRecording) return;
  
    wx.showLoading({
      title: "正在处理录音...",
      mask: true
    });
  
    // 保存当前组件实例的引用
    const that = this;
  
    // 定义录音停止事件的处理函数
    const handleStop = async (res) => {
      try {
        const fs = wx.getFileSystemManager();
        // 验证录音文件有效性
        const fileInfo = fs.statSync(res.tempFilePath);
        if (fileInfo.size < 1024) throw new Error("录音文件过小（小于1KB），可能录音失败");
  
        // 上传录音文件
        await that.uploadFile({
          path: res.tempFilePath,
          name: `录音-${Date.now()}.mp3`,
          size: fileInfo.size
        }, "record");
  
      } catch (err) {
        wx.showToast({ title: `录音失败：${err.message}`, icon: "none", duration: 2000 });
        console.error("录音处理失败：", err);
        that.clearTempFile(res.tempFilePath);
      } finally {
        wx.hideLoading();
        // 移除事件监听，避免重复处理
        recorder.offStop(handleStop);
      }
    };
  
    // 注册录音停止事件监听
    recorder.onStop(handleStop);
  
    // 停止录音
    recorder.stop();
    const { audioCtx } = this.data;
  
    // 停止伴奏播放
    if (audioCtx) {
      audioCtx.stop();
      audioCtx.src = "";
    }
  
    this.setData({ isRecording: false });
    this.clearRecordTimer();
  }
});
