document.addEventListener('DOMContentLoaded', () => {
  renderSidebar();
  renderTopbar();
});

function renderSidebar() {
  const sidebarContainer = document.getElementById('sidebar-container');
  if (!sidebarContainer) return;

  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  const user = getCurrentUser() || { name: 'Officer Sarah', role: 'Municipality Officer' };

  sidebarContainer.innerHTML = `
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="brand-icon">🛣️</div>
        <div class="brand-title">Smart Road AI</div>
      </div>
      <nav class="sidebar-nav">
        <a href="index.html" class="nav-item ${currentPath === 'index.html' || currentPath === '' ? 'active' : ''}">
          <span class="icon">📊</span> Executive Dashboard
        </a>
        <a href="detect.html" class="nav-item ${currentPath === 'detect.html' ? 'active' : ''}">
          <span class="icon">🔍</span> AI Detection Studio
        </a>
        <a href="live.html" class="nav-item ${currentPath === 'live.html' ? 'active' : ''}">
          <span class="icon">📹</span> Live Camera Feed
        </a>
        <a href="potholes.html" class="nav-item ${currentPath === 'potholes.html' || currentPath === 'pothole-details.html' ? 'active' : ''}">
          <span class="icon">🛑</span> Pothole Directory
        </a>
        <a href="map.html" class="nav-item ${currentPath === 'map.html' ? 'active' : ''}">
          <span class="icon">🗺️</span> GIS Map & Hotspots
        </a>
        <a href="complaints.html" class="nav-item ${currentPath === 'complaints.html' ? 'active' : ''}">
          <span class="icon">📥</span> Citizen Complaints
        </a>
        <a href="repairs.html" class="nav-item ${currentPath === 'repairs.html' ? 'active' : ''}">
          <span class="icon">🛠️</span> Repair Management
        </a>
        <a href="analytics.html" class="nav-item ${currentPath === 'analytics.html' ? 'active' : ''}">
          <span class="icon">📈</span> Road Analytics
        </a>
        <a href="reports.html" class="nav-item ${currentPath === 'reports.html' ? 'active' : ''}">
          <span class="icon">📄</span> Export Reports
        </a>
        <a href="notifications.html" class="nav-item ${currentPath === 'notifications.html' ? 'active' : ''}">
          <span class="icon">🔔</span> Notifications
        </a>
        <a href="users.html" class="nav-item ${currentPath === 'users.html' ? 'active' : ''}">
          <span class="icon">👥</span> Users
        </a>
        <a href="settings.html" class="nav-item ${currentPath === 'settings.html' ? 'active' : ''}">
          <span class="icon">⚙️</span> Settings
        </a>
      </nav>
      <div class="sidebar-footer">
        <div class="user-badge">
          <div class="user-avatar">${user.name ? user.name.charAt(0) : 'U'}</div>
          <div class="user-info">
            <span class="user-name">${user.name || 'User'}</span>
            <span class="user-role">${user.role || 'Officer'}</span>
          </div>
        </div>
        <button class="btn-icon" title="Logout" onclick="logout()">🚪</button>
      </div>
    </aside>
  `;
}

function renderTopbar() {
  const topbarContainer = document.getElementById('topbar-container');
  if (!topbarContainer) return;

  const titleMap = {
    'index.html': { title: 'Executive Road Dashboard', sub: 'Real-time pothole monitoring & municipal health telemetry' },
    'detect.html': { title: 'AI Detection Studio', sub: 'Upload image or video for YOLO pothole detection & severity analysis' },
    'live.html': { title: 'Live Camera Monitor', sub: 'Real-time video feed inference stream' },
    'potholes.html': { title: 'Master Pothole Directory', sub: 'Track, filter, and prioritize detected road defects' },
    'pothole-details.html': { title: 'Pothole Inspection Details', sub: 'Comprehensive lifecycle, detection logs, and explainable AI' },
    'map.html': { title: 'Interactive GIS Map & Hotspots', sub: 'Geospatial risk mapping and pothole spatial density clusters' },
    'complaints.html': { title: 'Citizen Complaint Portal', sub: 'Submit road damage reports with instant AI image verification' },
    'repairs.html': { title: 'Work Orders & AI Verification', sub: 'Assign field officers and verify repairs using before/after AI model' },
    'analytics.html': { title: 'Road Performance Analytics', sub: 'Pothole trend analysis, severity distribution, & repair efficiency' },
    'reports.html': { title: 'Report Generation Center', sub: 'Export municipal inspection PDF and CSV reports' },
    'notifications.html': { title: 'Notifications & Overdue Alerts', sub: 'In-app alert inbox and automatic escalation tracking' },
    'users.html': { title: 'User Management', sub: 'Manage municipality officers, field officers, and citizens' },
    'settings.html': { title: 'System Settings', sub: 'Configure AI thresholds, email alerts, and model weights' }
  };

  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  const info = titleMap[currentPath] || { title: 'Smart Road Monitoring', sub: 'Municipal AI Portal' };

  topbarContainer.innerHTML = `
    <header class="topbar">
      <div class="page-title-group">
        <h1>${info.title}</h1>
        <p>${info.sub}</p>
      </div>
      <div class="topbar-actions">
        <a href="notifications.html" class="btn-icon" title="Notifications">
          🔔
          <span class="badge-dot" id="notif-badge-dot"></span>
        </a>
      </div>
    </header>
  `;
}
