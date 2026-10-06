extends Node
class_name InventorySystem
## InventorySystem - Player inventory management for Slugs Royal

# Signals
signal inventory_changed
signal item_added(item: Variant, quantity: int)
signal item_removed(item: Variant, quantity: int)
signal item_used(item: Variant)

# Inventory structure
var items: Dictionary = {}

# Inventory limits
@export var max_weapons: int = 4
@export var max_slugs_per_type: int = 10
@export var max_health_items: int = 5
@export var max_armor_items: int = 5
@export var max_ammo_per_type: int = 50

# Current selection
var current_weapon_index: int = 0
var current_slug_index: int = 0

func _ready() -> void:
	# Initialize inventory
	items = {
		"weapons": [],
		"slugs": {},
		"health": 0,
		"armor": 0,
		"ammo": {}
	}

func add_weapon(weapon: Weapon) -> bool:
	if items["weapons"].size() >= max_weapons:
		return false
	
	items["weapons"].append(weapon)
	inventory_changed.emit()
	item_added.emit(weapon, 1)
	return true

func remove_weapon(index: int) -> Weapon:
	if index < 0 or index >= items["weapons"].size():
		return null
	
	var weapon = items["weapons"][index]
	items["weapons"].remove_at(index)
	
	# Update current weapon index
	if current_weapon_index >= index:
		current_weapon_index = max(0, current_weapon_index - 1)
	
	inventory_changed.emit()
	item_removed.emit(weapon, 1)
	return weapon

func add_slug(slug: SlugResource, quantity: int = 1) -> bool:
	var slug_name = slug.slug_name
	
	# Check if we already have this slug type
	if not items["slugs"].has(slug_name):
		items["slugs"][slug_name] = {"slug": slug, "quantity": 0}
	
	# Check limit
	if items["slugs"][slug_name]["quantity"] + quantity > max_slugs_per_type:
		return false
	
	items["slugs"][slug_name]["quantity"] += quantity
	inventory_changed.emit()
	item_added.emit(slug, quantity)
	return true

func use_slug(slug_name: String, quantity: int = 1) -> bool:
	if not items["slugs"].has(slug_name):
		return false
	
	if items["slugs"][slug_name]["quantity"] < quantity:
		return false
	
	items["slugs"][slug_name]["quantity"] -= quantity
	
	# Remove if quantity reaches zero
	if items["slugs"][slug_name]["quantity"] <= 0:
		items["slugs"].erase(slug_name)
	
	inventory_changed.emit()
	item_used.emit(items["slugs"][slug_name]["slug"])
	item_removed.emit(items["slugs"][slug_name]["slug"], quantity)
	return true

func get_slug_quantity(slug_name: String) -> int:
	if items["slugs"].has(slug_name):
		return items["slugs"][slug_name]["quantity"]
	return 0

func get_slug(slug_name: String) -> SlugResource:
	if items["slugs"].has(slug_name):
		return items["slugs"][slug_name]["slug"]
	return null

func get_all_slugs() -> Array:
	var slug_list = []
	for slug_name in items["slugs"]:
		var slug_data = items["slugs"][slug_name]
		slug_list.append({"name": slug_name, "slug": slug_data["slug"], "quantity": slug_data["quantity"]})
	return slug_list

func add_health(amount: float) -> void:
	items["health"] += amount
	inventory_changed.emit()

func add_armor(amount: float) -> void:
	items["armor"] += amount
	inventory_changed.emit()

func add_ammo(weapon_type: String, amount: int) -> bool:
	if not items["ammo"].has(weapon_type):
		items["ammo"][weapon_type] = 0
	
	if items["ammo"][weapon_type] + amount > max_ammo_per_type:
		return false
	
	items["ammo"][weapon_type] += amount
	inventory_changed.emit()
	item_added.emit(weapon_type, amount)
	return true

func use_ammo(weapon_type: String, amount: int) -> bool:
	if not items["ammo"].has(weapon_type):
		return false
	
	if items["ammo"][weapon_type] < amount:
		return false
	
	items["ammo"][weapon_type] -= amount
	
	# Remove if quantity reaches zero
	if items["ammo"][weapon_type] <= 0:
		items["ammo"].erase(weapon_type)
	
	inventory_changed.emit()
	item_removed.emit(weapon_type, amount)
	return true

func get_ammo_quantity(weapon_type: String) -> int:
	if items["ammo"].has(weapon_type):
		return items["ammo"][weapon_type]
	return 0

func get_weapon_count() -> int:
	return items["weapons"].size()

func get_weapon(index: int) -> Weapon:
	if index >= 0 and index < items["weapons"].size():
		return items["weapons"][index]
	return null

func get_current_weapon() -> Weapon:
	return get_weapon(current_weapon_index)

func get_current_weapon_index() -> int:
	return current_weapon_index

func set_current_weapon_index(index: int) -> void:
	current_weapon_index = clamp(index, 0, items["weapons"].size() - 1)
	inventory_changed.emit()

func get_current_slug() -> SlugResource:
	var slugs = get_all_slugs()
	if slugs.size() > current_slug_index:
		return slugs[current_slug_index]["slug"]
	return null

func get_current_slug_index() -> int:
	return current_slug_index

func set_current_slug_index(index: int) -> void:
	current_slug_index = clamp(index, 0, get_all_slugs().size() - 1)
	inventory_changed.emit()

func get_health_items() -> float:
	return items["health"]

func get_armor_items() -> float:
	return items["armor"]

func get_all_ammo() -> Dictionary:
	return items["ammo"]

func get_all_weapons() -> Array:
	return items["weapons"]

func clear_inventory() -> void:
	items = {
		"weapons": [],
		"slugs": {},
		"health": 0,
		"armor": 0,
		"ammo": {}
	}
	current_weapon_index = 0
	current_slug_index = 0
	inventory_changed.emit()

func has_item(item: Variant) -> bool:
	if item is Weapon:
		return item in items["weapons"]
	elif item is SlugResource:
		return item.slug_name in items["slugs"]
	elif typeof(item) == TYPE_STRING:
		# Check if it's a weapon type or slug name
		if items["slugs"].has(item):
			return true
		if items["ammo"].has(item):
			return true
		return false
	return false

func get_item_quantity(item: Variant) -> int:
	if item is SlugResource:
		return get_slug_quantity(item.slug_name)
	elif item is Weapon:
		return 1 if item in items["weapons"] else 0
	elif typeof(item) == TYPE_STRING:
		if items["slugs"].has(item):
			return items["slugs"][item]["quantity"]
		elif items["ammo"].has(item):
			return items["ammo"][item]
	return 0
