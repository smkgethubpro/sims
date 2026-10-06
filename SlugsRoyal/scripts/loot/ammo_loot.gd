extends LootItem
class_name AmmoLoot
## AmmoLoot - Loot item that provides ammunition

# Export variables
@export var ammo_amount: int = 30
@export var weapon_type: String = "Pistol"

func _ready() -> void:
	super()
	item_type = "Ammo"
	loot_category = 1  # Ammo
	item_name = weapon_type + " Ammo"

func _give_to_picker(picker: Node3D) -> bool:
	# Add ammo to picker's current weapon of the same type
	if picker.has_method("get_current_weapon"):
		var current_weapon = picker.get_current_weapon()
		if current_weapon and current_weapon.weapon_type == weapon_type:
			current_weapon.add_ammo(ammo_amount)
			
			# Play pickup sound
			AudioManager.play_sfx(AudioManager.pickup_sound)
			
			return true
		
		# Alternatively, add to inventory
		if picker.has_method("add_ammo"):
			picker.add_ammo(weapon_type, ammo_amount)
			AudioManager.play_sfx(AudioManager.pickup_sound)
			return true
	
	return false

func get_ammo_amount() -> int:
	return ammo_amount

func get_weapon_type() -> String:
	return weapon_type
