extends Control
class_name MainMenu

## MainMenu - Main menu for Slugs Royal

# Signals
signal play_pressed
signal assets_pressed
signal settings_pressed
signal about_pressed
signal exit_pressed

# Export variables
@export var play_button: Button
@export var assets_button: Button
@export var settings_button: Button
@export var about_button: Button
@export var exit_button: Button

func _ready() -> void:
	# Connect button signals
	if play_button:
		play_button.pressed.connect(_on_play_pressed)
	
	if assets_button:
		assets_button.pressed.connect(_on_assets_pressed)
	
	if settings_button:
		settings_button.pressed.connect(_on_settings_pressed)
	
	if about_button:
		about_button.pressed.connect(_on_about_pressed)
	
	if exit_button:
		exit_button.pressed.connect(_on_exit_pressed)

func _on_play_pressed() -> void:
	play_pressed.emit()
	
	# Change to lobby or start game
	GameManager.change_state(GameManager.GameState.LOBBY)

func _on_assets_pressed() -> void:
	assets_pressed.emit()
	
	# Open asset system
	var asset_system = get_node_or_null("/root/Game/AssetSystem")
	if asset_system:
		asset_system.show()

func _on_settings_pressed() -> void:
	settings_pressed.emit()
	
	# Open settings menu
	var settings_menu = get_node_or_null("/root/Game/SettingsMenu")
	if settings_menu:
		settings_menu.show()

func _on_about_pressed() -> void:
	about_pressed.emit()
	
	# Show about dialog
	var about_dialog = get_node_or_null("/root/Game/AboutDialog")
	if about_dialog:
		about_dialog.show()

func _on_exit_pressed() -> void:
	exit_pressed.emit()
	
	# Quit game
	get_tree().quit()

func show() -> void:
	visible = true
	
	# Pause game if in progress
	if GameManager.get_game_state() == GameManager.GameState.PLAYING:
		get_tree().paused = true

func hide() -> void:
	visible = false
	
	# Unpause game
	get_tree().paused = false
