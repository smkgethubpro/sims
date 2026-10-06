extends Node3D
class_name Weapon
## Weapon - Base weapon class for Slugs Royal

# Signals
signal fired
signal reloaded
signal ammo_changed(new_ammo: int)

# Export variables
@export var weapon_name: String = "Base Weapon"
@export var weapon_type: String = "Pistol"
@export var damage: float = 10.0
@export var fire_rate: float = 0.5
@export var max_ammo: int = 12
@export var reload_time: float = 1.5
@export var projectile_speed: float = 25.0
@export var spread: float = 0.1

# Current state
var current_ammo: int = 12
var is_reloading: bool = false
var can_fire: bool = true
var fire_cooldown: float = 0.0

# Projectile
@export var projectile_scene: PackedScene

# Audio
@export var fire_sound: AudioStream
@export var reload_sound: AudioStream

# Visuals
@export var muzzle_flash: PackedScene

# References
@onready var muzzle_position: Node3D = $Muzzle

func _ready() -> void:
	current_ammo = max_ammo

func _process(delta: float) -> void:
	# Handle fire cooldown
	if fire_cooldown > 0:
		fire_cooldown -= delta
		if fire_cooldown <= 0:
			can_fire = true

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
	
	# Create projectile
	if projectile_scene:
		var projectile = projectile_scene.instantiate()
		
		# Position at muzzle
		projectile.global_position = muzzle_position.global_position
		projectile.global_rotation = muzzle_position.global_rotation
		
		# Apply spread
		var direction = muzzle_position.global_transform.basis.z
		direction += Vector3(randf_range(-spread, spread), randf_range(-spread, spread), randf_range(-spread, spread))
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

func reload() -> void:
	if is_reloading:
		return
	
	is_reloading = true
	
	# Play reload sound
	if reload_sound:
		AudioManager.play_sfx(reload_sound)
	
	# Simulate reload time
	var timer = Timer.new()
	add_child(timer)
	timer.timeout.connect(_on_reload_complete.bind(timer))
	timer.start(reload_time)

func _on_reload_complete(timer: Timer) -> void:
	timer.queue_free()
	current_ammo = max_ammo
	is_reloading = false
	reloaded.emit()
	ammo_changed.emit(current_ammo)

func get_weapon_name() -> String:
	return weapon_name

func get_weapon_type() -> String:
	return weapon_type

func get_current_ammo() -> int:
	return current_ammo

func get_max_ammo() -> int:
	return max_ammo

func is_ready_to_fire() -> bool:
	return can_fire and not is_reloading and current_ammo > 0

func get_damage() -> float:
	return damage

func set_damage(new_damage: float) -> void:
	damage = new_damage

func set_ammo(amount: int) -> void:
	current_ammo = min(amount, max_ammo)
	ammo_changed.emit(current_ammo)

func add_ammo(amount: int) -> void:
	current_ammo = min(current_ammo + amount, max_ammo)
	ammo_changed.emit(current_ammo)
