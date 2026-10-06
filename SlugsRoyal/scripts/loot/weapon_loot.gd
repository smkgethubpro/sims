extends LootItem
class_name WeaponLoot
## WeaponLoot - Loot item that contains a weapon

# Export variables
@export var weapon_scene: PackedScene
@export var weapon_resource: Resource

# Weapon instance
var weapon_instance: Weapon

func _ready() -> void:
	super()
	item_type = "Weapon"
	loot_category = 0  # Weapon
	
	# Create weapon instance for preview
	if weapon_scene:
		weapon_instance = weapon_scene.instantiate()
		add_child(weapon_instance)
		weapon_instance.visible = false  # Hide until picked up

func _give_to_picker(picker: Node3D) -> bool:
	if not weapon_scene:
		return false
	
	# Create weapon instance
	var new_weapon = weapon_scene.instantiate()
	
	# Add to picker's inventory
	if picker.has_method("add_weapon"):
		picker.add_weapon(new_weapon)
		
		# Play pickup sound
		AudioManager.play_sfx(AudioManager.pickup_sound)
		
		return true
	
	return false

func get_weapon() -> Weapon:
	if weapon_instance:
		return weapon_instance
	return null
