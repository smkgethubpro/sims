extends Node3D
class_name BattleRoyaleZone
## BattleRoyaleZone - Shrinking safe zone for battle royale gameplay

# Signals
signal zone_updated(center: Vector3, radius: float)
signal zone_shrinking
signal player_outside_zone(player: Node3D)

# Export variables
@export var initial_radius: float = 500.0
@export var min_radius: float = 50.0
@export var shrink_interval: float = 30.0
@export var shrink_amount: float = 50.0
@export var damage_per_second: float = 10.0

# Current state
var current_radius: float
var current_center: Vector3 = Vector3.ZERO
var is_shrinking: bool = false

# Visual representation
@onready var zone_mesh: MeshInstance3D = $ZoneMesh
@onready var zone_edge: MeshInstance3D = $ZoneEdge

# Damage zones
var damage_zones: Array[Area3D] = []

func _ready() -> void:
	current_radius = initial_radius
	current_center = global_position
	
	# Start zone shrink timer
	var timer = Timer.new()
	add_child(timer)
	timer.timeout.connect(_on_shrink_timer.bind(timer))
	timer.start(shrink_interval)
	
	# Update visual representation
	_update_visuals()
	
	# Create initial damage zone
	_create_damage_zone()

func _on_shrink_timer(timer: Timer) -> void:
	# Shrink the zone
	current_radius = max(min_radius, current_radius - shrink_amount)
	
	# Update visuals
	_update_visuals()
	
	# Notify game manager
	zone_updated.emit(current_center, current_radius)
	zone_shrinking.emit()
	
	# Update damage zones
	_update_damage_zones()
	
	# Restart timer
	timer.start(shrink_interval)

func update_zone(center: Vector3, radius: float) -> void:
	current_center = center
	current_radius = radius
	global_position = center
	
	# Update visuals
	_update_visuals()
	
	# Update damage zones
	_update_damage_zones()
	
	zone_updated.emit(current_center, current_radius)

func _update_visuals() -> void:
	# Update zone mesh (safe area)
	if zone_mesh:
		var mesh = PlaneMesh.new()
		mesh.size = Vector2(current_radius * 2, current_radius * 2)
		zone_mesh.mesh = mesh
		
		var material = StandardMaterial3D.new()
		material.albedo_color = Color(0, 1, 0, 0.2)
		material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		material.cull_mode = BaseMaterial3D.CULL_DISABLED
		zone_mesh.material_override = material
		zone_mesh.position = Vector3(0, 0.1, 0)
	
	# Update zone edge (boundary)
	if zone_edge:
		var edge_mesh = TorusMesh.new()
		edge_mesh.outer_radius = current_radius
		edge_mesh.inner_radius = current_radius * 0.98
		edge_mesh.outer_segments = 64
		edge_mesh.inner_segments = 8
		zone_edge.mesh = edge_mesh
		
		var edge_material = StandardMaterial3D.new()
		edge_material.albedo_color = Color.RED
		edge_material.emission_color = Color.RED * 2.0
		edge_material.emission_enabled = true
		zone_edge.material_override = edge_material
		zone_edge.position = Vector3(0, 0.2, 0)

func _create_damage_zone() -> void:
	# Create a damage zone that covers the area outside the safe zone
	var damage_zone = Area3D.new()
	damage_zone.name = "DamageZone"
	add_child(damage_zone)
	
	# Create a large collision shape
	var collision = CollisionShape3D.new()
	collision.shape = SphereShape3D.new()
	collision.shape.radius = 1000.0  # Very large radius
	damage_zone.add_child(collision)
	
	# Connect body entered signal
	damage_zone.body_entered.connect(_on_body_entered_damage_zone.bind(damage_zone))
	damage_zone.body_exited.connect(_on_body_exited_damage_zone.bind(damage_zone))
	
	damage_zones.append(damage_zone)

func _update_damage_zones() -> void:
	# Update all damage zones
	for zone in damage_zones:
		# The damage zone covers everything, we'll check distance manually
		pass

func _on_body_entered_damage_zone(body: Node3D, zone: Area3D) -> void:
	# Check if body is outside safe zone
	if _is_outside_safe_zone(body.global_position):
		# Start applying damage
		if body.has_method("take_damage"):
			# Apply damage over time
			var timer = Timer.new()
			zone.add_child(timer)
			timer.timeout.connect(_apply_damage_to_body.bind(body, timer))
			timer.start(1.0)

func _on_body_exited_damage_zone(body: Node3D, zone: Area3D) -> void:
	# Stop applying damage
	pass

func _apply_damage_to_body(body: Node3D, timer: Timer) -> void:
	if body and _is_outside_safe_zone(body.global_position):
		if body.has_method("take_damage"):
			body.take_damage(damage_per_second)
			player_outside_zone.emit(body)
			timer.start(1.0)  # Continue applying damage
		else:
			timer.queue_free()
	else:
		timer.queue_free()

func _is_outside_safe_zone(position: Vector3) -> bool:
	return position.distance_to(current_center) > current_radius

func is_in_safe_zone(position: Vector3) -> bool:
	return not _is_outside_safe_zone(position)

func get_current_center() -> Vector3:
	return current_center

func get_current_radius() -> float:
	return current_radius

func get_time_until_next_shrink() -> float:
	# This would need to be tracked with the timer
	return shrink_interval
