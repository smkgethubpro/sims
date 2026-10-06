extends LootItem
class_name HealthLoot

## HealthLoot - Loot item that restores health

# Export variables
@export var heal_amount: float = 25.0

func _ready() -> void:
	super()
	item_type = "Health"
	loot_category = 3  # Health
	item_name = "Health Pack"

func _give_to_picker(picker: Node3D) -> bool:
	# Heal the picker
	if picker.has_method("heal"):
		picker.heal(heal_amount)
		
		# Play pickup sound
		AudioManager.play_sfx(AudioManager.pickup_sound)
		
		return true
	
	return false

func get_heal_amount() -> float:
	return heal_amount
