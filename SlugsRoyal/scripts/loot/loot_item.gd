extends Node3D
class_name LootItem
## LootItem - Base class for all loot items in Slugs Royal

# Signals
signal picked_up(picker: Node3D)
signal destroyed

# Export variables
@export var item_name: String = "Loot Item"
@export var item_type: String = "Other"
@export var icon: Texture2D
@export var pickup_range: float = 2.0
@export var respawn_time: float = 30.0

# Loot types
@export_enum("Weapon", "Ammo", "Slug", "Health", "Armor", "Other") var loot_category: int = 5

# Item properties
@export var quantity: int = 1
@export var max_stack: int = 1

# Visuals
@export var model: MeshInstance3D
@export var glow_effect: bool = true

# Current state
var is_available: bool = true
var respawn_timer: Timer

func _ready() -> void:
	# Setup collision for pickup
	var collision = CollisionShape3D.new()
	collision.shape = SphereShape3D.new()
	collision.shape.radius = pickup_range
	add_child(collision)
	
	# Add to loot group
	add_to_group("loot")
	
	# Setup glow effect
	if glow_effect:
		_setup_glow()

func _setup_glow() -> void:
	# Create a glowing effect for the loot
	var glow = MeshInstance3D.new()
	glow.mesh = SphereMesh.new()
	glow.scale = Vector3(1.2, 1.2, 1.2)
	
	var glow_material = StandardMaterial3D.new()
	glow_material.albedo_color = Color.WHITE
	glow_material.emission_color = Color.WHITE * 2.0
	glow_material.emission_enabled = true
	glow_material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	glow_material.albedo_alpha = 0.3
	glow_material.cull_mode = BaseMaterial3D.CULL_DISABLED
	
	glow.material_override = glow_material
	add_child(glow)
	
	# Animate glow
	var animation_player = AnimationPlayer.new()
	add_child(animation_player)
	
	var animation = Animation.new()
	animation.loop_mode = Animation.LOOP_LINEAR
	animation.length = 2.0
	
	var track = AnimationTrack.new()
	animation.add_track(track)
	track.interpolation_type = AnimationTrack.INTERPOLATION_LINEAR
	
	var key1 = AnimationKey.new()
	key1.time = 0.0
	key1.value = 0.3
	
	var key2 = AnimationKey.new()
	key2.time = 1.0
	key2.value = 0.5
	
	var key3 = AnimationKey.new()
	key3.time = 2.0
	key3.value = 0.3
	
	track.add_key(0, key1)
	track.add_key(1, key2)
	track.add_key(2, key3)
	
	animation_player.add_animation("glow", animation)
	animation_player.play("glow")

func pickup(picker: Node3D) -> bool:
	if not is_available:
		return false
	
	# Check if picker can pick up this item
	if not _can_pickup(picker):
		return false
	
	# Give item to picker
	if _give_to_picker(picker):
		is_available = false
		
		# Emit signal
		picked_up.emit(picker)
		
		# Hide loot
		visible = false
		
		# Start respawn timer
		if respawn_time > 0:
			_respawn_timer = Timer.new()
			add_child(respawn_timer)
			respawn_timer.timeout.connect(_on_respawn_timer)
			respawn_timer.start(respawn_time)
		
		return true
	
	return false

func _can_pickup(picker: Node3D) -> bool:
	# Default: anyone can pick up
	return true

func _give_to_picker(picker: Node3D) -> bool:
	# Default behavior: just notify the picker
	if picker.has_method("on_loot_picked_up"):
		return picker.on_loot_picked_up(self)
	
	return false

func _on_respawn_timer() -> void:
	# Respawn the loot
	is_available = true
	visible = true
	
	# Emit a signal or play effect
	if has_method("on_respawned"):
		on_respawned()

func get_item_name() -> String:
	return item_name

func get_item_type() -> String:
	return item_type

func get_quantity() -> int:
	return quantity

func get_icon() -> Texture2D:
	return icon

func get_loot_category() -> int:
	return loot_category
