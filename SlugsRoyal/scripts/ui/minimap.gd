extends Node2D
class_name Minimap
## Minimap - Minimap display for Slugs Royal

# Export variables
@export var map_scale: float = 0.1
@export var player_icon: Texture2D
@export var enemy_icon: Texture2D
@export var loot_icon: Texture2D
@export var zone_color: Color = Color(0, 1, 0, 0.5)
@export var danger_zone_color: Color = Color(1, 0, 0, 0.5)

# References
@onready var player_marker: Sprite2D = $PlayerMarker
@onready var zone_circle: Sprite2D = $ZoneCircle
@onready var danger_zone_circle: Sprite2D = $DangerZoneCircle

# Game references
var player: PlayerController
var game_manager: Node
var loot_system: LootSystem

# Map data
var map_size: Vector2 = Vector2(1000, 1000)
var map_offset: Vector2 = Vector2.ZERO

func _ready() -> void:
	# Find references
	player = get_node("/root/Game/Player")
	game_manager = GameManager
	loot_system = get_node("/root/Game/LootSystem")
	
	# Setup connections
	if game_manager:
		game_manager.zone_updated.connect(_on_zone_updated)
	
	# Update player marker
	_update_player_marker()

func _process(delta: float) -> void:
	# Update player marker position
	_update_player_marker()
	
	# Update enemy markers
	_update_enemy_markers()
	
	# Update loot markers
	_update_loot_markers()

func _update_player_marker() -> void:
	if not player or not player_marker:
		return
	
	# Convert player position to minimap coordinates
	var player_pos = _world_to_minimap(player.global_position)
	player_marker.position = player_pos
	player_marker.rotation = -player.global_transform.basis.get_euler().y

func _update_enemy_markers() -> void:
	# Clear existing enemy markers
	var enemies_container = get_node_or_null("Enemies")
	if enemies_container:
		for child in enemies_container.get_children():
			child.queue_free()
	
	# Add new enemy markers
	var enemies = get_tree().get_nodes_in_group("enemies")
	
	if not enemies_container:
		enemies_container = Node2D.new()
		enemies_container.name = "Enemies"
		add_child(enemies_container)
	
	for enemy in enemies:
		if enemy.is_visible_in_tree():
			var marker = Sprite2D.new()
			marker.texture = enemy_icon
			marker.scale = Vector2(0.5, 0.5)
			
			var enemy_pos = _world_to_minimap(enemy.global_position)
			marker.position = enemy_pos
			
			enemies_container.add_child(marker)

func _update_loot_markers() -> void:
	# Clear existing loot markers
	var loot_container = get_node_or_null("Loot")
	if loot_container:
		for child in loot_container.get_children():
			child.queue_free()
	
	# Add new loot markers
	if loot_system:
		var active_loot = loot_system.get_active_loot()
		
		if not loot_container:
			loot_container = Node2D.new()
			loot_container.name = "Loot"
			add_child(loot_container)
		
		for loot in active_loot:
			if loot.is_visible_in_tree():
				var marker = Sprite2D.new()
				marker.texture = loot_icon
				marker.scale = Vector2(0.4, 0.4)
				
				var loot_pos = _world_to_minimap(loot.global_position)
				marker.position = loot_pos
				
				loot_container.add_child(marker)

func _on_zone_updated(center: Vector3, radius: float) -> void:
	# Update safe zone circle
	if zone_circle:
		var center_pos = _world_to_minimap(center)
		zone_circle.position = center_pos
		zone_circle.scale = Vector2(radius * map_scale * 2, radius * map_scale * 2)
	
	# Update danger zone circle
	if danger_zone_circle:
		danger_zone_circle.position = center_pos
		danger_zone_circle.scale = Vector2(radius * map_scale * 2 * 1.2, radius * map_scale * 2 * 1.2)

func _world_to_minimap(world_pos: Vector3) -> Vector2:
	# Convert world position to minimap coordinates
	var x = (world_pos.x - map_offset.x) * map_scale
	var y = (world_pos.z - map_offset.y) * map_scale
	
	# Clamp to minimap bounds
	var half_size = get_viewport_rect().size * 0.5
	x = clamp(x, -half_size.x, half_size.x)
	y = clamp(y, -half_size.y, half_size.y)
	
	return Vector2(x, y)

func set_map_size(size: Vector2) -> void:
	map_size = size

func set_map_offset(offset: Vector2) -> void:
	map_offset = offset

func set_player(new_player: PlayerController) -> void:
	player = new_player
