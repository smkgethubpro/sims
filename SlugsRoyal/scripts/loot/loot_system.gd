extends Node
class_name LootSystem

## LootSystem - Central loot management system for Slugs Royal

# Export variables
@export var loot_spawn_interval: float = 5.0
@export var max_loot_items: int = 100
@export var loot_spawn_distance: float = 50.0

# Loot configurations
@export var loot_table: Array[Dictionary] = [
	{"type": "weapon", "weight": 10, "scene": null},
	{"type": "ammo", "weight": 30, "scene": null},
	{"type": "slug", "weight": 20, "scene": null},
	{"type": "health", "weight": 25, "scene": null},
	{"type": "armor", "weight": 15, "scene": null}
]

# Current loot items
var active_loot: Array[LootItem] = []

# Spawn points
var spawn_points: Array[Node3D] = []

func _ready() -> void:
	# Find all spawn points
	_spawn_points = get_tree().get_nodes_in_group("loot_spawn_points")
	
	# Start spawning loot
	var timer = Timer.new()
	add_child(timer)
	timer.timeout.connect(_on_spawn_timer)
	timer.start(loot_spawn_interval)

func _on_spawn_timer() -> void:
	# Spawn new loot if we're below max
	if active_loot.size() < max_loot_items:
		_spawn_random_loot()
	
	# Restart timer
	var timer = Timer.new()
	add_child(timer)
	timer.timeout.connect(_on_spawn_timer)
	timer.start(loot_spawn_interval)

func _spawn_random_loot() -> void:
	# Calculate total weight
	var total_weight = 0
	for config in loot_table:
		total_weight += config.get("weight", 1)
	
	# Select random loot type based on weights
	var random_value = randf() * total_weight
	var current_weight = 0
	var selected_config = null
	
	for config in loot_table:
		current_weight += config.get("weight", 1)
		if random_value <= current_weight:
			selected_config = config
			break
	
	if not selected_config:
		selected_config = loot_table[0]
	
	# Spawn the loot
	var loot_scene = _get_loot_scene(selected_config.get("type", "other"))
	if loot_scene:
		_spawn_loot(loot_scene, selected_config)

func _get_loot_scene(loot_type: String) -> PackedScene:
	# Return the appropriate loot scene based on type
	match loot_type:
		"weapon":
			return preload("res://scenes/loot/weapon_loot.tscn")
		"ammo":
			return preload("res://scenes/loot/ammo_loot.tscn")
		"slug":
			return preload("res://scenes/loot/slug_loot.tscn")
		"health":
			return preload("res://scenes/loot/health_loot.tscn")
		"armor":
			return preload("res://scenes/loot/armor_loot.tscn")
		_: 
			return preload("res://scenes/loot/loot_item.tscn")

func _spawn_loot(scene: PackedScene, config: Dictionary) -> void:
	# Find a random spawn point
	var spawn_point = _get_random_spawn_point()
	
	# Create loot instance
	var loot = scene.instantiate()
	
	# Configure loot based on type
	match config.get("type", "other"):
		"weapon":
			# Set weapon type
			if loot.has_method("set_weapon_type"):
				loot.set_weapon_type(_get_random_weapon_type())
		"ammo":
			# Set ammo type and amount
			if loot.has_method("set_ammo_amount"):
				loot.set_ammo_amount(randi_range(10, 30))
			if loot.has_method("set_weapon_type"):
				loot.set_weapon_type(_get_random_weapon_type())
		"slug":
			# Set slug type
			if loot.has_method("set_slug_type"):
				loot.set_slug_type(_get_random_slug_type())
		"health":
			# Set heal amount
			if loot.has_method("set_heal_amount"):
				loot.set_heal_amount(randf_range(15.0, 35.0))
		"armor":
			# Set armor amount
			if loot.has_method("set_armor_amount"):
				loot.set_armor_amount(randf_range(15.0, 35.0))
	
	# Position loot
	loot.global_position = spawn_point.global_position
	
	# Add to scene
	get_tree().root.add_child(loot)
	
	# Track active loot
	active_loot.append(loot)
	
	# Connect pickup signal
	loot.picked_up.connect(_on_loot_picked_up.bind(loot))
	loot.destroyed.connect(_on_loot_destroyed.bind(loot))

func _get_random_spawn_point() -> Node3D:
	if spawn_points.size() > 0:
		return spawn_points[randi() % spawn_points.size()]
	
	# Fallback: return a random position on the map
	var map_center = Vector3.ZERO
	if has_node("/root/Game/Map"):
		map_center = get_node("/root/Game/Map").global_position
	
	var random_angle = randf() * TAU
	var random_distance = randf_range(10.0, loot_spawn_distance)
	
	var spawn_pos = map_center + Vector3(cos(random_angle), 0, sin(random_angle)) * random_distance
	
	# Create a temporary node at this position
	var temp_node = Node3D.new()
	get_tree().root.add_child(temp_node)
	temp_node.global_position = spawn_pos
	
	return temp_node

func _get_random_weapon_type() -> String:
	var types = ["Pistol", "Assault Rifle", "Shotgun", "Sniper Rifle"]
	return types[randi() % types.size()]

func _get_random_slug_type() -> String:
	var types = ["Inferno", "Frostbite", "Thunder", "Toxic", "Terrabeast"]
	return types[randi() % types.size()]

func _on_loot_picked_up(loot: LootItem) -> void:
	# Remove from active loot list
	if loot in active_loot:
		active_loot.erase(loot)

func _on_loot_destroyed(loot: LootItem) -> void:
	# Remove from active loot list
	if loot in active_loot:
		active_loot.erase(loot)

func register_spawn_point(point: Node3D) -> void:
	spawn_points.append(point)

func get_active_loot() -> Array[LootItem]:
	return active_loot

func clear_all_loot() -> void:
	for loot in active_loot:
		loot.queue_free()
	active_loot.clear()
