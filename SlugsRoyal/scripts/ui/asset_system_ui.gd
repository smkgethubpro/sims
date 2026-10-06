extends Control
class_name AssetSystemUI

## AssetSystemUI - Asset management system UI for Slugs Royal

# Signals
signal asset_selected(asset: Dictionary)
signal asset_configured(asset: Dictionary, config: Dictionary)
signal close_requested

# Export variables
@export var asset_list: ItemList
@export var asset_preview: TextureRect
@export var asset_info: Label
@export var setup_button: Button
@export var close_button: Button

# Asset categories
@export var asset_categories: Array = ["Characters", "Guns", "Maps", "Other"]

# Current state
var current_category: String = "Characters"
var current_asset: Dictionary = {}
var assets: Dictionary = {
	"Characters": [],
	"Guns": [],
	"Maps": [],
	"Other": []
}

func _ready() -> void:
	# Connect signals
	if setup_button:
		setup_button.pressed.connect(_on_setup_pressed)
		setup_button.disabled = true
	
	if close_button:
		close_button.pressed.connect(_on_close_pressed)
	
	# Setup asset list
	_setup_asset_list()
	
	# Load sample assets
	_load_sample_assets()

func _setup_asset_list() -> void:
	if not asset_list:
		return
	
	asset_list.clear()
	
	# Add categories
	for category in asset_categories:
		asset_list.add_item(category, null, true)
		
		# Add assets for this category
		if assets.has(category):
			for asset in assets[category]:
				asset_list.add_item(asset["name"], asset)

	# Connect selection signal
	asset_list.item_selected.connect(_on_asset_selected)

func _load_sample_assets() -> void:
	# Load some sample assets for demonstration
	
	# Characters
	assets["Characters"] = [
		{"name": "Soldier", "type": "character", "path": "res://assets/models/characters/soldier.glb", "preview": null},
		{"name": "Scout", "type": "character", "path": "res://assets/models/characters/scout.glb", "preview": null},
		{"name": "Tank", "type": "character", "path": "res://assets/models/characters/tank.glb", "preview": null}
	]
	
	# Guns
	assets["Guns"] = [
		{"name": "Pistol", "type": "gun", "path": "res://assets/models/weapons/pistol.glb", "preview": null},
		{"name": "Assault Rifle", "type": "gun", "path": "res://assets/models/weapons/assault_rifle.glb", "preview": null},
		{"name": "Shotgun", "type": "gun", "path": "res://assets/models/weapons/shotgun.glb", "preview": null},
		{"name": "Sniper Rifle", "type": "gun", "path": "res://assets/models/weapons/sniper_rifle.glb", "preview": null}
	]
	
	# Maps
	assets["Maps"] = [
		{"name": "Island Map", "type": "map", "path": "res://assets/models/maps/island.glb", "preview": null},
		{"name": "City Map", "type": "map", "path": "res://assets/models/maps/city.glb", "preview": null}
	]
	
	# Update asset list
	_setup_asset_list()

func _on_asset_selected(index: int) -> void:
	var item = asset_list.get_item_at_index(index)
	
	# Check if it's a category
	if asset_list.is_item_selectable(index):
		current_category = asset_list.get_item_text(index)
		
		# Enable setup button only if an asset is selected
		if setup_button:
			setup_button.disabled = true
		
		# Clear preview
		if asset_preview:
			asset_preview.texture = null
		if asset_info:
			asset_info.text = "Select an asset from category: %s" % current_category
	else:
		# It's an asset
		current_asset = item
		
		# Show asset info
		if asset_info:
			asset_info.text = "Name: %s\nType: %s\nPath: %s" % [
				current_asset.get("name", "Unknown"),
				current_asset.get("type", "Unknown"),
				current_asset.get("path", "Unknown")
			]
		
		# Enable setup button
		if setup_button:
			setup_button.disabled = false
		
		# Show preview (placeholder)
		if asset_preview:
			# In a real implementation, you'd load the preview texture
			asset_preview.texture = null

func _on_setup_pressed() -> void:
	if current_asset.is_empty():
		return
	
	# Show configuration dialog based on asset type
	var asset_type = current_asset.get("type", "")
	
	match asset_type:
		"character":
			_show_character_config()
		"gun":
			_show_gun_config()
		"map":
			_show_map_config()
		_: 
			_show_generic_config()

func _show_character_config() -> void:
	# Create a configuration dialog for characters
	var dialog = AcceptDialog.new()
	dialog.title = "Configure Character"
	dialog.dialog_text = "Configure %s as:" % current_asset.get("name", "Character")
	
	# Add options
	var vbox = VBoxContainer.new()
	dialog.add_child(vbox)
	
	var player_check = CheckButton.new()
	player_check.text = "Playable Character"
	vbox.add_child(player_check)
	
	var ai_check = CheckButton.new()
	ai_check.text = "AI Character"
	vbox.add_child(ai_check)
	
	# Show dialog
	add_child(dialog)
	dialog.popup_centered()
	
	# Connect OK signal
	dialog.ok_pressed.connect(_on_character_config_confirmed.bind(dialog, player_check, ai_check))

func _on_character_config_confirmed(dialog: AcceptDialog, player_check: CheckButton, ai_check: CheckButton) -> void:
	var config = {
		"is_playable": player_check.button_pressed,
		"is_ai": ai_check.button_pressed
	}
	
	asset_configured.emit(current_asset, config)
	dialog.queue_free()

func _show_gun_config() -> void:
	# Create a configuration dialog for guns
	var dialog = AcceptDialog.new()
	dialog.title = "Configure Gun"
	dialog.dialog_text = "Configure %s as:" % current_asset.get("name", "Gun")
	
	# Add options
	var vbox = VBoxContainer.new()
	dialog.add_child(vbox)
	
	var weapon_type = OptionButton.new()
	weapon_type.add_item("Pistol")
	weapon_type.add_item("Assault Rifle")
	weapon_type.add_item("Shotgun")
	weapon_type.add_item("Sniper Rifle")
	weapon_type.selected = 0
	vbox.add_child(weapon_type)
	
	# Show dialog
	add_child(dialog)
	dialog.popup_centered()
	
	# Connect OK signal
	dialog.ok_pressed.connect(_on_gun_config_confirmed.bind(dialog, weapon_type))

func _on_gun_config_confirmed(dialog: AcceptDialog, weapon_type: OptionButton) -> void:
	var config = {
		"weapon_type": weapon_type.get_item_text(weapon_type.selected)
	}
	
	asset_configured.emit(current_asset, config)
	dialog.queue_free()

func _show_map_config() -> void:
	# Create a configuration dialog for maps
	var dialog = AcceptDialog.new()
	dialog.title = "Configure Map"
	dialog.dialog_text = "Configure %s as:" % current_asset.get("name", "Map")
	
	# Add options
	var vbox = VBoxContainer.new()
	dialog.add_child(vbox)
	
	var map_size = HSlider.new()
	map_size.min_value = 100
	map_size.max_value = 2000
	map_size.value = 500
	map_size.step = 10
	vbox.add_child(map_size)
	
	# Show dialog
	add_child(dialog)
	dialog.popup_centered()
	
	# Connect OK signal
	dialog.ok_pressed.connect(_on_map_config_confirmed.bind(dialog, map_size))

func _on_map_config_confirmed(dialog: AcceptDialog, map_size: HSlider) -> void:
	var config = {
		"size": map_size.value
	}
	
	asset_configured.emit(current_asset, config)
	dialog.queue_free()

func _show_generic_config() -> void:
	# Create a generic configuration dialog
	var dialog = AcceptDialog.new()
	dialog.title = "Configure Asset"
	dialog.dialog_text = "Configure %s" % current_asset.get("name", "Asset")
	
	# Show dialog
	add_child(dialog)
	dialog.popup_centered()
	
	# Connect OK signal
	dialog.ok_pressed.connect(_on_generic_config_confirmed.bind(dialog))

func _on_generic_config_confirmed(dialog: AcceptDialog) -> void:
	var config = {}
	
	asset_configured.emit(current_asset, config)
	dialog.queue_free()

func _on_close_pressed() -> void:
	close_requested.emit()
	hide()

func add_asset(asset: Dictionary, category: String = "Other") -> void:
	if not assets.has(category):
		assets[category] = []
	
	assets[category].append(asset)
	
	# Refresh asset list
	_setup_asset_list()

func remove_asset(asset_name: String, category: String = "Other") -> bool:
	if not assets.has(category):
		return false
	
	for i in range(assets[category].size()):
		if assets[category][i].get("name", "") == asset_name:
			assets[category].remove_at(i)
			_setup_asset_list()
			return true
	
	return false

func show() -> void:
	visible = true
	get_tree().paused = true

func hide() -> void:
	visible = false
	get_tree().paused = false
