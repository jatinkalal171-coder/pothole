import os
import datetime
from flask import Blueprint, request, jsonify
from werkzeug.utils import secure_filename
from backend.database import get_db
from backend.ai.detector import get_detector
from backend.services.priority_service import calculate_priority_score
from backend.config import UPLOADS_DIR, COMPLAINTS_DIR

complaint_bp = Blueprint('complaints', __name__)

@complaint_bp.route('', methods=['POST'])
def submit_complaint():
    if 'image' not in request.files:
        return jsonify({"error": "Pothole photo image is required"}), 400

    file = request.files['image']
    if file.filename == '':
        return jsonify({"error": "No image file selected"}), 400

    description = request.form.get('description', 'Citizen Pothole Complaint')
    location_name = request.form.get('location_name', 'Unknown Location')
    user_name = request.form.get('user_name', 'Citizen Reporter')
    user_email = request.form.get('user_email', 'citizen@gmail.com')
    
    lat_val = request.form.get('latitude')
    lng_val = request.form.get('longitude')
    if not lat_val or not lng_val:
        return jsonify({"error": "Location coordinates are required. Please use 'USE MY CURRENT LOCATION' or click on the map."}), 400
    
    try:
        lat = float(lat_val)
        lng = float(lng_val)
    except ValueError:
        return jsonify({"error": "Invalid location coordinates provided."}), 400

    stamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"complaint_{stamp}_{secure_filename(file.filename)}"
    raw_path = os.path.join(COMPLAINTS_DIR, filename)
    file.save(raw_path)

    # Automatic AI Analysis of uploaded complaint photo
    detector = get_detector()
    result = detector.detect_image_file(raw_path, save_annotated=True)

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM complaints")
    next_cmp = cursor.fetchone()[0] + 1
    cmp_id = f"CMP-2026-{next_cmp:05d}"

    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    pothole_id = None
    severity_score = 0
    risk_level = "LOW"

    if result['total_potholes'] > 0:
        det = result['detections'][0]
        severity_score = det['severity_score']
        risk_level = det['risk_level']

        prio_res = calculate_priority_score(
            severity_score=det['severity_score'],
            risk_level=det['risk_level'],
            road_importance="MEDIUM"
        )

        cursor.execute("SELECT COUNT(*) FROM potholes")
        next_p = cursor.fetchone()[0] + 1
        pothole_id = f"PT-2026-{next_p:04d}"

        rel_ann_path = os.path.relpath(result['annotated_image_path'], UPLOADS_DIR).replace('\\', '/')

        cursor.execute('''
        INSERT INTO potholes (
            pothole_id, confidence, width, height, area, severity_score, 
            risk_level, priority_score, road_name, latitude, longitude, 
            image_path, annotated_image_path, detected_at, last_detected_at, 
            detection_count, status, road_importance
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'OPEN', 'MEDIUM')
        ''', (
            pothole_id, det['confidence'], det['width'], det['height'], det['area'],
            det['severity_score'], det['risk_level'], prio_res['priority_score'],
            location_name, lat, lng,
            os.path.relpath(raw_path, UPLOADS_DIR).replace('\\', '/'),
            rel_ann_path, now_str, now_str
        ))

    rel_comp_img = os.path.relpath(raw_path, UPLOADS_DIR).replace('\\', '/')

    cursor.execute('''
    INSERT INTO complaints (
        complaint_id, pothole_id, user_name, user_email, description, 
        location_name, latitude, longitude, image_path, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'SUBMITTED', ?)
    ''', (cmp_id, pothole_id, user_name, user_email, description, location_name, lat, lng, rel_comp_img, now_str))

    cursor.execute('''
    INSERT INTO notifications (user_id, title, message, type, read_status, created_at)
    VALUES (2, '📥 New Citizen Complaint Submitted', ?, 'ALERT', 0, ?)
    ''', (f"Complaint {cmp_id} submitted for {location_name}", now_str))

    conn.commit()
    conn.close()

    return jsonify({
        "success": True,
        "complaint_id": cmp_id,
        "pothole_id": pothole_id,
        "risk_level": risk_level,
        "severity_score": severity_score,
        "status": "SUBMITTED",
        "message": "Complaint submitted and AI verified successfully!"
    }), 201

@complaint_bp.route('', methods=['GET'])
def get_complaints():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM complaints ORDER BY created_at DESC")
    complaints = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify({"complaints": complaints, "count": len(complaints)})
