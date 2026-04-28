# OutOfCycle

## Purpose
Improve and fix YouTube playlist shuffle behavior by preventing duplicate plays and incomplete loading issues.

---

## Usage Notes

### Installation
1. Install **Tampermonkey** browser extension  
   https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo
2. Go to GreasyFork and click “Install”
3. Ensure the **OutOfCycle** script is enabled in Tampermonkey

---

### Supported Pages
- Playlist pages only  
  https://www.youtube.com/playlist?list=*
- Click **START** on the playlist page  
  If clicked on a video watch page (`watch?v=*`), it will redirect to the playlist page automatically

---

### Playback Behavior
- Automatically switches to the next video **1.5 seconds before** the current one ends  
  (Reducing this time is not recommended due to loading delays)
- When revisiting the same playlist, press **NEXT** to continue the previous shuffle cycle
- To return to single-track repeat, press **STOP** to terminate the shuffle script

---

## Shuffle Logic

### Auto Loading & Detection
- Automatically scrolls to the bottom of the playlist to load all videos
- Continuously checks loading status and starts shuffle playback once complete

### No Duplicate Playback
- Generates a full randomized queue
- Ensures no video is repeated within a single shuffle cycle
- Press **RESHUFFLE** to generate a new random order

### Completion Detection
1. **Video Count Match**  
   Loading is complete when the loaded video count matches the displayed total
2. **Last Element Check**  
   Designed for playlists containing hidden or deleted videos  
   If the last video element is the final item in the container, loading is considered complete

---

## Bug Reports & Support
- Please report issues via GitHub Issues
- Replies may use machine translation; thank you for your understanding

---

## Support the Author
- Ko-fi  
  https://ko-fi.com/rmt120430
- You are also welcome to visit my GitHub profile for more projects

---

# OutOfCycle

## 專案目的
優化並修正 YouTube 播放清單的隨機播放行為，避免重複播放與載入不完整問題。

---

## 使用注意事項

### 安裝步驟
1. 先安裝瀏覽器擴充套件 **Tampermonkey**  
   https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo
2. 前往 GreasyFork，點擊「一鍵安裝」
3. 確認 **OutOfCycle** 腳本已在 Tampermonkey 中啟用

---

### 適用頁面
- 僅適用於播放清單頁面  
  https://www.youtube.com/playlist?list=*
- 請在播放清單頁面點擊 **START**  
  若在播放頁面（`watch?v=*`）按下，會自動跳轉至清單頁面

---

### 播放機制說明
- 影片結束前 **1.5 秒** 會自動切換至下一首  
  （不建議縮短時間，避免因載入延遲導致腳本失效）
- 下次回到同一播放清單時，可按 **NEXT** 繼續上一次的隨機迴圈
- 若要回到單曲重播，請按 **STOP** 結束隨機播放腳本

---

## 隨機播放原理

### 自動載入與檢查
- 自動捲動清單頁面至底部，確保所有影片皆被載入
- 持續檢查載入狀態，完成後自動開始隨機播放

### 不重複隨機
- 產生完整的亂數播放佇列
- 確保單一播放迴圈中不會重複播放同一影片
- 點擊 **RESHUFFLE** 可重新生成新的隨機順序

### 載入完成判定條件
1. **影片數量比對**  
   當已載入數量等於顯示的總影片數，即判定完成
2. **最後影片元素檢查**  
   適用於清單中包含「已隱藏 / 已刪除」影片的情況  
   若最後一個影片元素為容器中的最後項目，即判定完成

---

## 問題回報與協助
- 請使用 GitHub Issues 回報問題
- 我會透過翻譯工具回覆，敬請見諒

---

## 支持作者
- Ko-fi  
  https://ko-fi.com/rmt120430
- 也歡迎造訪我的 GitHub 主頁，查看其他有趣的專案
