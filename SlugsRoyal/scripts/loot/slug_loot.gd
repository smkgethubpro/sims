extends LootItem
class_name SlugLoot
## SlugLoot - Loot item that contains a slug

# Export variables
@export var slug_resource: SlugResource
@export var slug_type: String = ""

func _ready() -> void:
	super()
	item_type = "Slug"
	loot_category = 2  # Slug
	
	if slug_resource:
		item_name = slug_resource.slug_name
		icon = slug_resource.icon

func _give_to_picker(picker: Node3D) -> bool:
	if not slug_resource:
		return false
	
	# Add slug to picker's inventory
	if picker.has_method("add_slug"):
		picker.add_slug(slug_resource, quantity)
		
		# Play pickup sound
		AudioManager.play_sfx(AudioManager.pickup_sound)
		
		return true
	
	return false

func get_slug() -> SlugResource:
	return slug_resource
