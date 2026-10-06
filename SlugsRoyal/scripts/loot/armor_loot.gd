extends LootItem
class_name ArmorLoot

## ArmorLoot - Loot item that provides armor

# Export variables
@export var armor_amount: float = 25.0

func _ready() -> void:
	super()
	item_type = "Armor"
	loot_category = 4  # Armor
	item_name = "Armor Plate"

func _give_to_picker(picker: Node3D) -> bool:
	# Add armor to picker
	if picker.has_method("add_armor"):
		picker.add_armor(armor_amount)
		
		# Play pickup sound
		AudioManager.play_sfx(AudioManager.pickup_sound)
		
		return true
	
	return false

func get_armor_amount() -> float:
	return armor_amount
