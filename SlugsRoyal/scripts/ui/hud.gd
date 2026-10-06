extends CanvasLayer
class_name HUD
## HUD - Heads-up display for Slugs Royal

# Export variables
@export var health_bar: ProgressBar
@export var armor_bar: ProgressBar
@export var ammo_label: Label
@export var weapon_label: Label
@export var slug_label: Label
@export var minimap: Node
@export var enemy_count_label: Label
@export var zone_timer_label: Label
@export var interaction_prompt: Label

# Player reference
var player: PlayerController

# Game references
@onready var game_manager: Node = GameManager

func _ready() -> void:
	# Find player
	var players = get_tree().get_nodes_in_group("players")
	if players.size() > 0:
		player = players[0] as PlayerController
		_setup_player_connections()
	
	# Setup game manager connections
	if game_manager:
		game_manager.game_state_changed.connect(_on_game_state_changed)

func _setup_player_connections() -> void:
	if not player:
		return
	
	# Connect to player signals
	player.health_changed.connect(_on_health_changed)
	player.armor_changed.connect(_on_armor_changed)
	player.ammo_changed.connect(_on_ammo_changed)
	player.weapon_changed.connect(_on_weapon_changed)
	player.slug_changed.connect(_on_slug_changed)
	player.died.connect(_on_player_died)

func _on_game_state_changed(new_state: int) -> void:
	# Update HUD based on game state
	pass

func _on_health_changed(new_health: float) -> void:
	if health_bar:
		health_bar.value = new_health
		health_bar.max_value = player.max_health

func _on_armor_changed(new_armor: float) -> void:
	if armor_bar:
		armor_bar.value = new_armor
		armor_bar.max_value = player.max_armor

func _on_ammo_changed(new_ammo: int) -> void:
	if ammo_label and player.current_weapon:
		ammo_label.text = "%d/%d" % [new_ammo, player.current_weapon.max_ammo]

func _on_weapon_changed(new_weapon: Weapon) -> void:
	if weapon_label:
		if new_weapon:
			weapon_label.text = new_weapon.weapon_name
		else:
			weapon_label.text = "None"
	
	if ammo_label and new_weapon:
		ammo_label.text = "%d/%d" % [new_weapon.current_ammo, new_weapon.max_ammo]

func _on_slug_changed(new_slug: SlugResource) -> void:
	if slug_label:
		if new_slug:
			slug_label.text = new_slug.slug_name + " (%d)" % player.get_current_slug_quantity()
		else:
			slug_label.text = "None"

func _on_player_died() -> void:
	# Show defeat message
	if has_node("DefeatPanel"):
		var defeat_panel = get_node("DefeatPanel")
		defeat_panel.visible = true

func update_minimap(minimap_data: Dictionary) -> void:
	if minimap:
		# Update minimap with new data
		pass

func update_enemy_count(count: int) -> void:
	if enemy_count_label:
		enemy_count_label.text = "Enemies: %d" % count

func update_zone_timer(time_remaining: float) -> void:
	if zone_timer_label:
		var minutes = int(time_remaining) / 60
		var seconds = int(time_remaining) % 60
		zone_timer_label.text = "Zone: %02d:%02d" % [minutes, seconds]

func show_interaction_prompt(prompt: String) -> void:
	if interaction_prompt:
		interaction_prompt.text = prompt
		interaction_prompt.visible = true

func hide_interaction_prompt() -> void:
	if interaction_prompt:
		interaction_prompt.visible = false

func set_player(new_player: PlayerController) -> void:
	player = new_player
	_setup_player_connections()
	
	# Update all displays
	if health_bar:
		health_bar.value = player.health
		health_bar.max_value = player.max_health
	
	if armor_bar:
		armor_bar.value = player.armor
		armor_bar.max_value = player.max_armor
	
	if player.current_weapon:
		_on_weapon_changed(player.current_weapon)
	
	if player.current_slug:
		_on_slug_changed(player.current_slug)
