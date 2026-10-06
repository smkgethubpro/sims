extends Weapon
class_name Shotgun

## Shotgun - Spread weapon with multiple pellets

# Shotgun-specific properties
@export var pellet_count: int = 8
@export var pellet_spread: float = 0.3

func _init():
	super()
	weapon_name = "Shotgun"
	weapon_type = "Shotgun"
	damage = 6.0  # Damage per pellet
	fire_rate = 0.8
	max_ammo = 8
	reload_time = 2.5
	projectile_speed = 20.0
	spread = 0.0

func fire(firer: Node3D) -> void:
	if not can_fire or is_reloading or current_ammo <= 0:
		return
	
	can_fire = false
	fire_cooldown = fire_rate
	current_ammo -= 1
	
	# Play fire sound
	if fire_sound:
		AudioManager.play_sfx(fire_sound)
	
	# Create muzzle flash
	if muzzle_flash and muzzle_position:
		var flash = muzzle_flash.instantiate()
		flash.global_position = muzzle_position.global_position
		flash.global_rotation = muzzle_position.global_rotation
		firer.get_parent().add_child(flash)
	
	# Create multiple pellets
	for i in range(pellet_count):
		if projectile_scene:
			var projectile = projectile_scene.instantiate()
			
			# Position at muzzle
			projectile.global_position = muzzle_position.global_position
			projectile.global_rotation = muzzle_position.global_rotation
			
			# Apply spread for each pellet
			var direction = muzzle_position.global_transform.basis.z
			direction += Vector3(
				randf_range(-pellet_spread, pellet_spread),
				randf_range(-pellet_spread, pellet_spread),
				randf_range(-pellet_spread, pellet_spread)
			)
			direction = direction.normalized()
			
			# Set projectile properties
			if projectile.has_method("set_direction"):
				projectile.set_direction(direction)
			if projectile.has_method("set_damage"):
				projectile.set_damage(damage)
			if projectile.has_method("set_speed"):
				projectile.set_speed(projectile_speed)
			if projectile.has_method("set_owner"):
				projectile.set_owner(firer)
			
			# Add to scene
			firer.get_parent().add_child(projectile)
	
	# Emit signal
	fired.emit()
	ammo_changed.emit(current_ammo)
