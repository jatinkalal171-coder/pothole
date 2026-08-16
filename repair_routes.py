import os
import datetime
from flask import Blueprint, request, jsonify
from werkzeug.utils import secure_filename
from backend.database import get_db
from backend.ai.detector import get_detector
from backend.config import UPLOADS_DIR, REPAIRS_DIR

repair_bp = Blueprint('repairs', __name__)

@repair_bp.route('', methods=['GET'])
def get_repairs():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
    SELECT r.*, p.priority_score, p.risk_level, p.road_name, p.severity_score
    FROM repairs r
    JOIN potholes p ON r.pothole_id = p.pothole_id
    ORDER BY r.created_at DESC
    ''')
    repairs = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify({"repairs": repairs, "count": len(repairs)})

@repair_bp.route('', methods=['POST'])
def assign_repair():
    data = request.get_json() or {}
    pothole_id = data.get('pothole_id')
    assigned_officer_id = data.get('assigned_officer_id', 3)
    assigned_officer_name = data.get('assigned_officer_name', 'Field Officer 07')
    department = data.get('department', 'Road Maintenance Dept')
    deadline = data.get('deadline')

    if not pothole_id:
        return jsonify({"error": "Pothole ID is required"}), 400

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT image_path FROM potholes WHERE pothole_id = ?", (pothole_id,))
    pothole = cursor.fetchone()
    if not pothole:
        conn.close()
        return jsonify({"error": "Pothole not found"}), 404

    cursor.execute("SELECT COUNT(*) FROM repairs")
    next_rep = cursor.fetchone()[0] + 1
    rep_id = f"REP-2026-{next_rep:04d}"

    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    cursor.execute('''
    INSERT INTO repairs (
        repair_id, pothole_id, assigned_officer_id, assigned_officer_name, 
        department, deadline, assigned_date, repair_status, before_image_path, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'ASSIGNED', ?, ?)
    ''', (rep_id, pothole_id, assigned_officer_id, assigned_officer_name, department, deadline, now_str, pothole['image_path'], now_str))

    cursor.execute("UPDATE potholes SET status = 'ASSIGNED' WHERE pothole_id = ?", (pothole_id,))

    # Create notification for field officer
    cursor.execute('''
    INSERT INTO notifications (user_id, title, message, type, read_status, created_at)
    VALUES (?, '🛠️ New Repair Work Order Assigned', ?, 'ASSIGNMENT', 0, ?)
    ''', (assigned_officer_id, f"Work Order {rep_id} assigned for Pothole {pothole_id}. Deadline: {deadline}", now_str))

    # Audit log
    cursor.execute('''
    INSERT INTO audit_logs (user_id, user_name, action, pothole_id, details, timestamp)
    VALUES (2, 'Municipality Officer', 'Repair Work Order Assigned', ?, ?, ?)
    ''', (pothole_id, f"Assigned to {assigned_officer_name} under {rep_id}", now_str))

    conn.commit()
    conn.close()

    return jsonify({
        "message": "Repair assigned successfully",
        "repair_id": rep_id,
        "pothole_id": pothole_id,
        "assigned_officer": assigned_officer_name,
        "deadline": deadline
    }), 201

@repair_bp.route('/<repair_id>/verify', methods=['POST'])
def verify_repair(repair_id):
    if 'after_image' not in request.files:
        return jsonify({"error": "Repair proof photo (after_image) is required"}), 400

    file = request.files['after_image']
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400

    stamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"repair_proof_{stamp}_{secure_filename(file.filename)}"
    raw_path = os.path.join(REPAIRS_DIR, filename)
    file.save(raw_path)

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM repairs WHERE repair_id = ?", (repair_id,))
    repair = cursor.fetchone()
    if not repair:
        conn.close()
        return jsonify({"error": "Repair order not found"}), 404

    pothole_id = repair['pothole_id']

    # AI Model Inference on Repair Proof Image
    detector = get_detector()
    result = detector.detect_image_file(raw_path, save_annotated=True)

    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    rel_after = os.path.relpath(raw_path, UPLOADS_DIR).replace('\\', '/')

    if result['total_potholes'] == 0:
        # Pothole fixed! AI Verification SUCCESS!
        v_res = "VERIFIED"
        r_status = "VERIFIED_CLOSED"
        p_status = "CLOSED"
        message = "AI REPAIR VERIFIED! Pothole is completely repaired. Ticket Closed."
        n_title = "✅ Repair AI Verified & Closed"
        n_msg = f"AI verified successful repair of Pothole {pothole_id}."
    else:
        # Pothole still detected! Verification FAILED!
        v_res = "FAILED"
        r_status = "FAILED_ESCALATED"
        p_status = "UNDER_REPAIR"
        message = "REPAIR VERIFICATION FAILED! Pothole still detected in repair photo."
        n_title = "❌ Repair AI Verification Failed"
        n_msg = f"AI verification failed for Pothole {pothole_id}. Pothole still detected!"

    cursor.execute('''
    UPDATE repairs 
    SET after_image_path = ?, verification_result = ?, repair_status = ?, repair_date = ?, verification_notes = ?
    WHERE repair_id = ?
    ''', (rel_after, v_res, r_status, now_str, message, repair_id))

    cursor.execute("UPDATE potholes SET status = ? WHERE pothole_id = ?", (p_status, pothole_id))

    # Notification
    cursor.execute('''
    INSERT INTO notifications (user_id, title, message, type, read_status, created_at)
    VALUES (2, ?, ?, ?, 0, ?)
    ''', (n_title, n_msg, 'VERIFICATION' if v_res == 'VERIFIED' else 'CRITICAL', now_str))

    # Audit Log
    cursor.execute('''
    INSERT INTO audit_logs (user_id, user_name, action, pothole_id, details, timestamp)
    VALUES (3, 'Field Officer & AI Engine', 'AI Repair Verification Attempted', ?, ?, ?)
    ''', (pothole_id, message, now_str))

    conn.commit()
    conn.close()

    return jsonify({
        "success": True,
        "verification_result": v_res,
        "pothole_status": p_status,
        "potholes_detected_in_proof": result['total_potholes'],
        "message": message
    })
