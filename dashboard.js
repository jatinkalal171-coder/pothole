document.addEventListener('DOMContentLoaded', () => {
  requireAuth();
  loadDashboardData();
});

let miniMap = null;

async function loadDashboardData() {
  try {
    const data = await apiFetch('/api/stats');
    if (!data) return;

    // Update KPIs
    document.getElementById('kpi-total').textContent = data.total_potholes || 0;
    document.getElementById('kpi-critical').textContent = data.risk_breakdown?.CRITICAL || 0;
    document.getElementById('kpi-high').textContent = data.risk_breakdown?.HIGH || 0;
    document.getElementById('kpi-closed').textContent = data.status_breakdown?.CLOSED || 0;
    document.getElementById('kpi-overdue').textContent = data.overdue_count || 0;

    // Update Road Health Score Banner
    const rh = data.road_health || {};
    const scoreElem = document.getElementById('health-score-num');
    const condElem = document.getElementById('health-score-cond');
    
    if (scoreElem && condElem) {
      scoreElem.textContent = rh.health_score !== undefined ? `${rh.health_score}/100` : '--';
      scoreElem.style.color = rh.color_hex || '#fff';
      condElem.textContent = rh.condition || 'GOOD';
      condElem.style.color = rh.color_hex || '#fff';
      
      document.getElementById('health-summary-text').textContent = 
        `Monitored Potholes: ${rh.total_potholes || 0} | Critical/High Priority: ${rh.critical_high_potholes || 0} | Average Severity: ${rh.average_severity || 0}/100`;
    }

    // Populate Recent Potholes Table
    const tbody = document.getElementById('recent-potholes-tbody');
    if (tbody && data.recent_detections) {
      if (data.recent_detections.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:1.5rem;">No potholes detected yet.</td></tr>`;
      } else {
        tbody.innerHTML = data.recent_detections.map(p => `
          <tr>
            <td><a href="pothole-details.html?id=${p.pothole_id}" style="color:var(--accent-cyan); font-weight:700;">${p.pothole_id}</a></td>
            <td>${p.road_name}</td>
            <td>${p.confidence.toFixed(1)}%</td>
            <td><strong>${p.severity_score}/100</strong></td>
            <td>${renderRiskBadge(p.risk_level)}</td>
            <td><span class="badge" style="background:rgba(255,255,255,0.08);">${p.status}</span></td>
          </tr>
        `).join('');
      }
    }

    // Load mini map
    initMiniMap();

  } catch (err) {
    console.error('Error loading dashboard:', err);
  }
}

async function initMiniMap() {
  const mapElem = document.getElementById('mini-map');
  if (!mapElem) return;

  if (miniMap) {
    miniMap.remove();
  }

  miniMap = L.map('mini-map');

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap'
  }).addTo(miniMap);

  try {
    const res = await apiFetch('/api/map/markers');
    if (res && res.markers && res.markers.length > 0) {
      const bounds = [];

      res.markers.forEach(m => {
        const color = m.risk_level === 'CRITICAL' ? '#a855f7' : m.risk_level === 'HIGH' ? '#ef4444' : m.risk_level === 'MEDIUM' ? '#f97316' : '#eab308';
        const marker = L.circleMarker([m.latitude, m.longitude], {
          radius: 8,
          fillColor: color,
          color: '#fff',
          weight: 1,
          opacity: 1,
          fillOpacity: 0.85
        }).addTo(miniMap);

        bounds.push([m.latitude, m.longitude]);

        marker.bindPopup(`
          <strong style="color:${color};">${m.pothole_id}</strong><br>
          Risk: <b>${m.risk_level}</b> | Sev: <b>${m.severity_score}/100</b><br>
          <a href="pothole-details.html?id=${m.pothole_id}">View Details</a>
        `);
      });

      if (bounds.length === 1) {
        miniMap.setView(bounds[0], 14);
      } else {
        miniMap.fitBounds(bounds, { padding: [20, 20] });
      }
    } else {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => miniMap.setView([pos.coords.latitude, pos.coords.longitude], 12),
          () => miniMap.setView([20.5937, 78.9629], 5),
          { timeout: 5000 }
        );
      } else {
        miniMap.setView([20.5937, 78.9629], 5);
      }
    }
  } catch (err) {
    console.error('Mini map marker load error:', err);
    miniMap.setView([20.5937, 78.9629], 5);
  }
}
