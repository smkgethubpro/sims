extends Node
## GameManager - Central game state management for Slugs Royal

# Game states
enum GameState { MENU, LOBBY, PLAYING, PAUSED, VICTORY, DEFEAT }

# Signals
signal game_state_changed(new_state: GameState)
signal player_eliminated
signal victory_achieved
signal defeat_occurred

# Game configuration
@export var max_players: int = 50
@export var initial_safe_zone_radius: float = 500.0
@export var safe_zone_shrink_rate: float = 0.5
@export var damage_outside_zone: float = 10.0
@export var zone_shrink_interval: float = 30.0

# Current state
var current_state: GameState = GameState.MENU
var players_alive: int = 0
var current_match_time: float = 0.0
var safe_zone_radius: float = 0.0
var safe_zone_center: Vector3 = Vector3.ZERO

# References
var player: Node3D
var current_map: Node3D
var hud: Node
var minimap: Node

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	safe_zone_radius = initial_safe_zone_radius
	change_state(GameState.MENU)

func change_state(new_state: GameState) -> void:
	current_state = new_state
	game_state_changed.emit(new_state)
	
	match new_state:
		GameState.MENU:
			_on_enter_menu()
		GameState.LOBBY:
			_on_enter_lobby()
		GameState.PLAYING:
			_on_enter_playing()
		GameState.PAUSED:
			_on_enter_paused()
		GameState.VICTORY:
			_on_enter_victory()
		GameState.DEFEAT:
			_on_enter_defeat()

func _on_enter_menu() -> void:
	print("Entered MENU state")
	current_match_time = 0.0

func _on_enter_lobby() -> void:
	print("Entered LOBBY state")

func _on_enter_playing() -> void:
	print("Entered PLAYING state")
	current_match_time = 0.0
	players_alive = max_players
	safe_zone_radius = initial_safe_zone_radius
	# Start zone shrink timer
	var timer = Timer.new()
	add_child(timer)
	timer.timeout.connect(_on_zone_shrink_timer.bind(timer))
	timer.start(zone_shrink_interval)

func _on_enter_paused() -> void:
	print("Entered PAUSED state")

func _on_enter_victory() -> void:
	print("Entered VICTORY state")
	victory_achieved.emit()

func _on_enter_defeat() -> void:
	print("Entered DEFEAT state")
	defeat_occurred.emit()

func _on_zone_shrink_timer(timer: Timer) -> void:
	if current_state != GameState.PLAYING:
		timer.queue_free()
		return
	
	safe_zone_radius = max(50.0, safe_zone_radius - safe_zone_shrink_rate)
	# Notify zone system to update
	if has_node("/root/Game/Zone"):
		get_node("/root/Game/Zone").update_zone(safe_zone_center, safe_zone_radius)
	
	# Restart timer
	timer.start(zone_shrink_interval)

func _process(delta: float) -> void:
	if current_state == GameState.PLAYING:
		current_match_time += delta
		# Check if player is outside safe zone
		if player and player.global_position.distance_to(safe_zone_center) > safe_zone_radius:
			# Apply damage to player
			if player.has_method("take_damage"):
				player.take_damage(damage_outside_zone * delta)

func register_player(player_node: Node3D) -> void:
	player = player_node

func register_map(map_node: Node3D) -> void:
	current_map = map_node

func register_hud(hud_node: Node) -> void:
	hud = hud_node

func register_minimap(minimap_node: Node) -> void:
	minimap = minimap_node

func player_eliminated_count() -> void:
	players_alive -= 1
	if players_alive <= 1:
		# Check if this player won
		if player and player.is_in_group("players"):
			change_state(GameState.VICTORY)
		else:
			change_state(GameState.DEFEAT)

func get_game_state() -> GameState:
	return current_state

func get_match_time() -> float:
	return current_match_time

func get_safe_zone_radius() -> float:
	return safe_zone_radius

func get_safe_zone_center() -> Vector3:
	return safe_zone_center

func start_match() -> void:
	change_state(GameState.PLAYING)

func end_match() -> void:
	if players_alive <= 1:
		change_state(GameState.VICTORY)
	else:
		change_state(GameState.DEFEAT)
