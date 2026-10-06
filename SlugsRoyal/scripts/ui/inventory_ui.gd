extends Control
class_name InventoryUI
## InventoryUI - Inventory user interface for Slugs Royal

# Signals
signal item_selected(item: Variant)
signal close_requested

# Export variables
@export var weapon_grid: GridContainer
@export var slug_grid: GridContainer
@export var ammo_grid: GridContainer
@export var item_info_label: Label

# References
var inventory: InventorySystem
var player: PlayerController

# UI elements
var weapon_buttons: Array[Button] = []
var slug_buttons: Array[Button] = []

func _ready() -> void:
	# Find references
	inventory = get_node_or_null("/root/Game/Inventory")
	player = get_node_or_null("/root/Game/Player")
	
	if inventory:
		inventory.inventory_changed.connect(_on_inventory_changed)
	
	# Setup UI
	_setup_weapon_grid()
	_setup_slug_grid()
	_setup_ammo_grid()
	
	# Update display
	_update_display()

func _setup_weapon_grid() -> void:
	if not weapon_grid:
		return
	
	# Clear existing buttons
	for child in weapon_grid.get_children():
		child.queue_free()
	weapon_buttons.clear()
	
	# Create weapon slots
	for i in range(inventory.max_weapons):
		var button = Button.new()
		button.name = "WeaponSlot_%d" % i
		button.text = "Empty"
		button.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
		button.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		button.pressed.connect(_on_weapon_selected.bind(i))
		
		weapon_grid.add_child(button)
		weapon_buttons.append(button)

func _setup_slug_grid() -> void:
	if not slug_grid:
		return
	
	# Clear existing buttons
	for child in slug_grid.get_children():
		child.queue_free()
	slug_buttons.clear()

func _setup_ammo_grid() -> void:
	if not ammo_grid:
		return

func _on_inventory_changed() -> void:
	_update_display()

func _update_display() -> void:
	if not inventory:
		return
	
	# Update weapons
	_update_weapons()
	
	# Update slugs
	_update_slugs()
	
	# Update ammo
	_update_ammo()

func _update_weapons() -> void:
	if not weapon_grid:
		return
	
	var weapons = inventory.get_all_weapons()
	
	for i in range(weapon_buttons.size()):
		var button = weapon_buttons[i]
		
		if i < weapons.size():
			var weapon = weapons[i]
			button.text = weapon.weapon_name
			button.disabled = false
			
			# Highlight current weapon
			if i == inventory.get_current_weapon_index():
				button.modulate = Color.YELLOW
			else:
				button.modulate = Color.WHITE
		else:
			button.text = "Empty"
			button.disabled = true
			button.modulate = Color.GRAY

func _update_slugs() -> void:
	if not slug_grid:
		return
	
	# Clear existing slug buttons
	for child in slug_grid.get_children():
		child.queue_free()
	slug_buttons.clear()
	
	# Get all slugs
	var slugs = inventory.get_all_slugs()
	
	# Create buttons for each slug type
	for i in range(slugs.size()):
		var slug_data = slugs[i]
		var button = Button.new()
		button.name = "SlugButton_%d" % i
		button.text = "%s (%d)" % [slug_data["name"], slug_data["quantity"]]
		button.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
		button.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		button.pressed.connect(_on_slug_selected.bind(i))
		
		# Highlight current slug
		if i == inventory.get_current_slug_index():
			button.modulate = Color.YELLOW
		
		slug_grid.add_child(button)
		slug_buttons.append(button)

func _update_ammo() -> void:
	if not ammo_grid:
		return
	
	# Clear existing ammo labels
	for child in ammo_grid.get_children():
		child.queue_free()
	
	# Get all ammo types
	var ammo = inventory.get_all_ammo()
	
	# Create labels for each ammo type
	for ammo_type in ammo:
		var label = Label.new()
		label.text = "%s: %d" % [ammo_type, ammo[ammo_type]]
		label.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
		
		ammo_grid.add_child(label)

func _on_weapon_selected(index: int) -> void:
	if inventory:
		inventory.set_current_weapon_index(index)
		
		# Close inventory
		close_requested.emit()
	
	# Update display to show selection
	_update_weapons()

func _on_slug_selected(index: int) -> void:
	if inventory:
		inventory.set_current_slug_index(index)
		
		# Close inventory
		close_requested.emit()
	
	# Update display to show selection
	_update_slugs()

func show() -> void:
	visible = true
	_update_display()

func hide() -> void:
	visible = false

func toggle() -> void:
	if visible:
		hide()
		close_requested.emit()
	else:
		show()
