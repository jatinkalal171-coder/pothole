import math
from backend.config import CAMERA_HEIGHT_METERS, CAMERA_PITCH_DEG, CAMERA_FOVY_DEG

def estimate_pothole_distance(bbox, frame_shape):
    """
    Defensible Monocular Pinhole Camera Ground-Plane Distance Estimator.
    
    Computes distance Z from camera to pothole based on the bottom-center coordinate 
    of the bounding box (where the pothole rests on the road ground plane).
    
    Parameters:
        bbox (list/tuple): [x1, y1, x2, y2] bounding box coordinates in pixels.
        frame_shape (tuple): (height, width) or (height, width, channels) of the frame.
        
    Returns:
        dict: {
            "distance_meters": float or None,
            "distance_str": str (e.g. "6.4 m"),
            "reliability": str ("High", "Medium", "Low", or "Calibration Required"),
            "is_valid": bool
        }
    """
    if not bbox or len(bbox) < 4 or not frame_shape or frame_shape[0] <= 0:
        return {
            "distance_meters": None,
            "distance_str": "Calibration required",
            "reliability": "Calibration Required",
            "is_valid": False
        }

    frame_h = frame_shape[0]
    y2 = bbox[3]  # Bottom edge of bounding box (contact point with road surface)
    
    # Normalized vertical position of pothole bottom (0.0 = top, 1.0 = bottom)
    norm_y = y2 / float(frame_h)
    
    # Horizon / sky check: if bottom edge is near top of frame (norm_y < 0.20), not on road ground plane
    if norm_y < 0.20 or norm_y > 0.98:
        return {
            "distance_meters": None,
            "distance_str": "Calibration required",
            "reliability": "Low / Calibration Required",
            "is_valid": False
        }
        
    try:
        # Camera projection parameters
        h_cam = float(CAMERA_HEIGHT_METERS)
        pitch_rad = math.radians(float(CAMERA_PITCH_DEG))
        fovy_rad = math.radians(float(CAMERA_FOVY_DEG))
        
        # Effective focal length in vertical pixels
        fy = frame_h / (2.0 * math.tan(fovy_rad / 2.0))
        y_center = frame_h / 2.0
        
        # Vertical angle of ray relative to optical center
        angle_off_axis = math.atan((y2 - y_center) / fy)
        
        # Total ray angle relative to ground plane horizon
        total_angle = pitch_rad + angle_off_axis
        
        if total_angle <= 0.02:  # Ray points at or above horizon line
            return {
                "distance_meters": None,
                "distance_str": "Calibration required",
                "reliability": "Calibration Required",
                "is_valid": False
            }
            
        # Ground plane distance formula
        distance_z = h_cam / math.tan(total_angle)
        
        # Clamp distance bounds (0.5m to 50.0m)
        if distance_z < 0.5 or distance_z > 50.0:
            return {
                "distance_meters": round(distance_z, 1) if distance_z > 0 else None,
                "distance_str": f"{round(distance_z, 1)} m" if 0 < distance_z <= 80 else "Calibration required",
                "reliability": "Low",
                "is_valid": False
            }
            
        # Determine reliability score
        if 0.45 <= norm_y <= 0.90:
            reliability = "High"
        elif 0.25 <= norm_y < 0.45:
            reliability = "Medium"
        else:
            reliability = "Low"
            
        dist_rounded = round(distance_z, 1)
        
        return {
            "distance_meters": dist_rounded,
            "distance_str": f"{dist_rounded} m",
            "reliability": reliability,
            "is_valid": True
        }
        
    except Exception as e:
        return {
            "distance_meters": None,
            "distance_str": "Calibration required",
            "reliability": "Calibration Required",
            "is_valid": False
        }
