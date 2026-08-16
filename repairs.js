document.addEventListener('DOMContentLoaded', () => {
  requireAuth();
  loadRepairsList();
  loadOpenPotholesDropdown();
});

async function loadOpenPotholesDropdown() {
  try {
    const data = await apiFetch('/api/potholes?status=OPEN');
    const selectElem = document.getElementById('assign-pothole-id');
    if (!selectElem) return;

    if (!data || !data.potholes || data.potholes.length === 0) {
      selectElem.innerHTML = '<option value="">No OPEN Potholes Available</option>';
      return;
    }

    selectElem.innerHTML = '<option value="">Select OPEN Pothole...</option>' + data.potholes.map(p => `
      <option value="${p.pothole_id}">${p.pothole_id} - ${p.road_name || 'Road Segment'} (Risk: ${p.risk_level}, Priority: ${p.priority_score})</option>
    `).join('');
  } catch (err) {
    console.error('Error loading OPEN potholes dropdown:', err);
  }
}

// Issue Work Order Handler
document.getElementById('assign-repair-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const potholeId = document.getElementById('assign-pothole-id').value.trim();
  if (!potholeId) {
    showToast('Please select a valid OPEN Pothole ID', 'warning');
    return;
  }

  const officerVal = document.getElementById('assign-officer').value.split('|');
  const payload = {
    pothole_id: potholeId,
    assigned_officer_id: parseInt(officerVal[0]),
    assigned_officer_name: officerVal[1],
    department: document.getElementById('assign-dept').value,
    deadline: document.getElementById('assign-deadline').value
  };

  const btn = document.getElementById('assign-btn');
  btn.disabled = true;
  btn.textContent = 'Issuing Work Order... ⏳';

  try {
    const res = await apiFetch('/api/repairs', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    if (res && res.repair_id) {
      showToast(`Work order ${res.repair_id} assigned successfully!`, 'success');
      loadRepairsList();
      loadOpenPotholesDropdown();
    }
  } catch (err) {
    console.error('Work order assign error:', err);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Issue Work Order 🛠️';
  }
});

// Run AI Repair Verification Handler
document.getElementById('verify-repair-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const repairId = document.getElementById('verify-repair-id').value;
  const fileInput = document.getElementById('verify-after-image');

  if (!repairId || !fileInput.files[0]) {
    showToast('Please select a work order and upload repair proof photo', 'warning');
    return;
  }

  const formData = new FormData();
  formData.append('after_image', fileInput.files[0]);

  const btn = document.getElementById('verify-btn');
  btn.disabled = true;
  btn.textContent = 'Running AI Verification Model... ⏳';

  try {
    const res = await apiFetch(`/api/repairs/${repairId}/verify`, {
      method: 'POST',
      body: formData
    });

    if (res && res.success) {
      const resBox = document.getElementById('verify-result-box');
      resBox.style.display = 'block';

      if (res.verification_result === 'VERIFIED') {
        resBox.style.background = 'rgba(16, 185, 129, 0.15)';
        resBox.style.border = '1px solid var(--status-good)';
        resBox.innerHTML = `
          <div style="font-weight:800; font-size:1.05rem; color:var(--status-good); margin-bottom:0.4rem;">✅ REPAIR VERIFIED BY AI</div>
          <div>${res.message}</div>
          <div style="margin-top:0.4rem; font-size:0.8rem; color:var(--text-muted);">Potholes detected in proof image: <b>0</b> | Ticket Status: <b>CLOSED</b></div>
        `;
        showToast('Repair AI Verified & Ticket Closed!', 'success');
      } else {
        resBox.style.background = 'rgba(239, 68, 68, 0.15)';
        resBox.style.border = '1px solid var(--status-high)';
        resBox.innerHTML = `
          <div style="font-weight:800; font-size:1.05rem; color:var(--status-high); margin-bottom:0.4rem;">❌ REPAIR VERIFICATION FAILED</div>
          <div>${res.message}</div>
          <div style="margin-top:0.4rem; font-size:0.8rem; color:var(--text-muted);">Potholes still detected in proof image: <b>${res.potholes_detected_in_proof}</b> | Ticket Status: <b>UNDER REPAIR / ESCALATED</b></div>
        `;
        showToast('Verification Failed! Pothole still detected.', 'error');
      }

      loadRepairsList();
      loadOpenPotholesDropdown();
    }
  } catch (err) {
    console.error('Repair verification error:', err);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Run AI Verification Inspection 🔬';
  }
});

async function loadRepairsList() {
  try {
    const data = await apiFetch('/api/repairs');
    if (!data) return;

    const tbody = document.getElementById('repairs-tbody');
    const selectElem = document.getElementById('verify-repair-id');

    if (!data.repairs || data.repairs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:2rem;">No repair work orders created yet.</td></tr>`;
      selectElem.innerHTML = `<option value="">No Active Work Orders</option>`;
      return;
    }

    // Populate Table
    tbody.innerHTML = data.repairs.map(r => {
      const vColor = r.verification_result === 'VERIFIED' ? 'var(--status-good)' : r.verification_result === 'FAILED' ? 'var(--status-high)' : 'var(--text-muted)';
      return `
        <tr>
          <td><strong style="color:var(--accent-cyan);">${r.repair_id}</strong></td>
          <td><a href="pothole-details.html?id=${r.pothole_id}" style="color:var(--accent-blue);">${r.pothole_id}</a></td>
          <td>${r.assigned_officer_name}</td>
          <td>${r.deadline || 'N/A'}</td>
          <td><span class="badge" style="background:rgba(255,255,255,0.1);">${r.repair_status}</span></td>
          <td><strong style="color:${vColor}">${r.verification_result}</strong></td>
        </tr>
      `;
    }).join('');

    // Populate Select Options for Verification Form
    selectElem.innerHTML = '<option value="">Select Work Order...</option>' + data.repairs.map(r => `
      <option value="${r.repair_id}">${r.repair_id} - ${r.pothole_id} (${r.repair_status})</option>
    `).join('');

  } catch (err) {
    console.error('Error loading repairs list:', err);
  }
}
