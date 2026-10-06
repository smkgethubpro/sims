extends Resource
class_name SlugResource
## SlugResource - Base resource class for all slug types in Slugs Royal

# Slug properties
@export var slug_name: String = "Base Slug"
@export var description: String = "A basic slug"
@export var icon: Texture2D
@export var color: Color = Color.WHITE

# Gameplay properties
@export var damage: float = 10.0
@export var projectile_speed: float = 20.0
@export var cooldown: float = 1.0
@export var area_radius: float = 0.0
@export var duration: float = 0.0

# Visual effects
@export var projectile_scene: PackedScene
@export var impact_effect: PackedScene
@export var muzzle_effect: PackedScene

# Audio
@export var fire_sound: AudioStream
@export var impact_sound: AudioStream

# Slug type enum
@export_enum("Fire", "Ice", "Electric", "Toxic", "Earth") var slug_type: int = 0

# Virtual function to be overridden by specific slug types
func activate(firer: Node3D, weapon: Node3D) -> void:
	# Default implementation - fire a simple projectile
	fire_projectile(firer, weapon)

func fire_projectile(firer: Node3D, weapon: Node3D) -> void:
	if not projectile_scene:
		return
	
	var projectile = projectile_scene.instantiate()
	
	# Position projectile at weapon muzzle
	var muzzle_pos = weapon.global_position + weapon.global_transform.basis.z * 0.5
	projectile.global_position = muzzle_pos
	
	# Set projectile direction
	if projectile.has_method("set_direction"):
		projectile.set_direction(firer.global_transform.basis.z)
	
	# Set projectile properties
	if projectile.has_method("set_damage"):
		projectile.set_damage(damage)
	if projectile.has_method("set_speed"):
		projectile.set_speed(projectile_speed)
	
	# Set projectile owner
	if projectile.has_method("set_owner"):
		projectile.set_owner(firer)
	
	# Add to scene
	firer.get_parent().add_child(projectile)
	
	# Play fire sound
	if fire_sound:
		AudioManager.play_sfx(fire_sound)
	
	# Play muzzle effect
	if muzzle_effect:
		var effect = muzzle_effect.instantiate()
		effect.global_position = muzzle_pos
		firer.get_parent().add_child(effect)
		effect.call_deferred("play")

func apply_effect(target: Node3D, hit_position: Vector3) -> void:
	# Default effect - just apply damage
	if target.has_method("take_damage"):
		target.take_damage(damage)
	
	# Play impact effect
	if impact_effect:
		var effect = impact_effect.instantiate()
		effect.global_position = hit_position
		target.get_parent().add_child(effect)
		effect.call_deferred("play")
	
	# Play impact sound
	if impact_sound:
		AudioManager.play_sfx(impact_sound)

func get_slug_name() -> String:
	return slug_name

func get_description() -> String:
	return description

func get_icon() -> Texture2D:
	return icon

func get_color() -> Color:
	return color

func get_cooldown() -> float:
	return cooldown

func get_damage() -> float:
	return damage
