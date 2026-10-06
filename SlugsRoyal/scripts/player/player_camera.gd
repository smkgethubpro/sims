extends Node3D
class_name PlayerCamera
## PlayerCamera - Third-person camera controller for Slugs Royal

# Export variables
@export var target: Node3D
@export var offset: Vector3 = Vector3(0, 1.5, 3.0)
@export var look_at_offset: Vector3 = Vector3(0, 1.0, 0)
@export var rotation_speed: float = 5.0
@export var zoom_speed: float = 2.0
@export var min_distance: float = 1.0
@export var max_distance: float = 10.0
@export var collision_margin: float = 0.5
@export var field_of_view: float = 60.0
@export var aiming_fov: float = 45.0

# Camera state
var current_distance: float
var target_distance: float
var is_aiming: bool = false
var camera_node: Camera3D

# Raycast for collision
var camera_ray: RayCast3D

func _ready() -> void:
	# Create camera node
	camera_node = Camera3D.new()
	add_child(camera_node)
	camera_node.make_current()
	
	# Setup raycast for collision
	camera_ray = RayCast3D.new()
	add_child(camera_ray)
	camera_ray.target_position = -Vector3.FORWARD * max_distance
	camera_ray.collide_with_areas = false
	camera_ray.collide_with_bodies = true
	
	current_distance = offset.z
	target_distance = offset.z
	
	# Set initial FOV
	camera_node.fov = field_of_view

func _process(delta: float) -> void:
	if not target:
		return
	
	# Update camera position and rotation
	_update_camera_position(delta)
	
	# Handle collision
	_handle_collision()

func _update_camera_position(delta: float) -> void:
	if not target:
		return
	
	# Calculate target position
	var target_pos = target.global_position + look_at_offset
	
	# Calculate camera position based on current distance
	var camera_pos = target_pos + target.global_transform.basis.z * -current_distance
	camera_pos += Vector3.UP * offset.y
	
	# Look at target
	look_at(target_pos, Vector3.UP)
	
	# Smooth distance transition
	current_distance = lerp(current_distance, target_distance, delta * zoom_speed)
	
	# Set camera position
	camera_node.global_position = camera_pos
	
	# Set FOV based on aiming state
	if is_aiming:
		camera_node.fov = lerp(camera_node.fov, aiming_fov, delta * zoom_speed)
	else:
		camera_node.fov = lerp(camera_node.fov, field_of_view, delta * zoom_speed)

func _handle_collision() -> void:
	if not camera_ray.is_colliding():
		return
	
	# Camera is hitting something, adjust distance
	var collision_point = camera_ray.get_collision_point()
	var target_pos = target.global_position + look_at_offset
	var desired_distance = target_pos.distance_to(collision_point) - collision_margin
	
	# Only adjust if the desired distance is less than current
	if desired_distance < current_distance:
		target_distance = desired_distance
		current_distance = desired_distance

func set_aiming(aiming: bool) -> void:
	is_aiming = aiming
	if aiming:
		target_distance = min_distance
	else:
		target_distance = offset.z

func zoom_in() -> void:
	target_distance = max(min_distance, target_distance - 1.0)

func zoom_out() -> void:
	target_distance = min(max_distance, target_distance + 1.0)

func set_target(new_target: Node3D) -> void:
	target = new_target

func get_camera() -> Camera3D:
	return camera_node
