extends CharacterBody3D
class_name PlayerController

## PlayerController - Third-person player controller for Slugs Royal

# Signals
signal health_changed(new_health: float)
signal armor_changed(new_armor: float)
signal ammo_changed(new_ammo: int)
signal weapon_changed(new_weapon: Weapon)
signal slug_changed(new_slug: SlugResource)
signal died
signal respawned
signal inventory_opened
signal inventory_closed

# Export variables
@export var move_speed: float = 5.0
@export var sprint_multiplier: float = 1.8
@export var crouch_multiplier: float = 0.5
@export var jump_velocity: float = 4.5
@export var mouse_sensitivity: float = 0.002
@export var camera_distance: float = 3.0
@export var camera_height: float = 1.5
@export var camera_collision_margin: float = 0.5
@export var gravity: float = ProjectSettings.get_setting("physics/3d/default_gravity")

# Player stats
@export var max_health: float = 100.0
@export var max_armor: float = 100.0

# Current state
var health: float = max_health
var armor: float = 0.0
var current_speed: float = move_speed
var is_sprinting: bool = false
var is_crouching: bool = false
var is_aiming: bool = false
var is_reloading: bool = false
var can_shoot: bool = true
var shoot_cooldown: float = 0.0

# Camera
var camera_pivot: Node3D
var camera_node: Camera3D
var camera_arm: Node3D

# Movement
var move_direction: Vector2 = Vector2.ZERO
var target_velocity: Vector3 = Vector3.ZERO

# Combat
var current_weapon: Weapon
var weapons: Array[Weapon] = []
var current_weapon_index: int = 0

# Slug system
var current_slug: SlugResource
var slugs: Array[SlugResource] = []
var slug_quantities: Dictionary = {}

# Inventory
var inventory_open: bool = false

# References
@onready var animation_player: AnimationPlayer = $AnimationPlayer
@onready var hitbox: Area3D = $Hitbox

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_PHYSICS
	
	# Setup camera
	_setup_camera()
	
	# Setup input
	_setup_input()
	
	# Initialize with default weapon
	if weapons.size() > 0:
		current_weapon = weapons[0]
		weapon_changed.emit(current_weapon)
	
	# Initialize with default slug
	if slugs.size() > 0:
		current_slug = slugs[0]
		slug_changed.emit(current_slug)

func _setup_camera() -> void:
	# Create camera hierarchy
	camera_arm = Node3D.new()
	add_child(camera_arm)
	camera_arm.position = Vector3(0, camera_height, 0)
	
	camera_pivot = Node3D.new()
	camera_arm.add_child(camera_pivot)
	
	camera_node = Camera3D.new()
	camera_pivot.add_child(camera_node)
	camera_node.position = Vector3(0, 0, camera_distance)
	
	# Make this the current camera
	camera_node.make_current()
	
	# Enable camera collision
	camera_node.cull_mask = 0xFFFFFFFF & ~(1 << get_world_3d().get_viewport().get_visible_layers().size())

func _setup_input() -> void:
	# Enable input processing
	Input.set_mouse_mode(Input.MOUSE_MODE_CAPTURED)

func _input(event: InputEvent) -> void:
	if inventory_open:
		# Handle inventory input
		if event.is_action_pressed("inventory"):
			close_inventory()
		return
	
	# Movement input
	move_direction = Vector2.ZERO
	
	if event.is_action_pressed("move_forward"):
		move_direction.y += 1.0
	if event.is_action_pressed("move_back"):
		move_direction.y -= 1.0
	if event.is_action_pressed("move_left"):
		move_direction.x -= 1.0
	if event.is_action_pressed("move_right"):
		move_direction.x += 1.0
	
	# Sprint
	is_sprinting = event.is_action_pressed("sprint") and move_direction.length() > 0
	
	# Crouch
	is_crouching = event.is_action_pressed("crouch")
	
	# Jump
	if event.is_action_pressed("jump") and is_on_floor():
		velocity.y = jump_velocity
	
	# Aim
	is_aiming = event.is_action_pressed("aim")
	
	# Shoot
	if event.is_action_pressed("shoot") and can_shoot and current_weapon:
		shoot()
	
	# Reload
	if event.is_action_pressed("reload") and current_weapon:
		reload()
	
	# Interact
	if event.is_action_pressed("interact"):
		interact()
	
	# Inventory
	if event.is_action_pressed("inventory"):
		toggle_inventory()
	
	# Weapon switch
	if event.is_action_pressed("weapon_switch") and weapons.size() > 1:
		switch_weapon()
	
	# Mouse look
	if event is InputEventMouseMotion and not inventory_open:
		rotate_y(deg_to_rad(-event.relative.x * mouse_sensitivity))
		camera_arm.rotate_x(deg_to_rad(-event.relative.y * mouse_sensitivity))
		# Clamp camera rotation
		camera_arm.rotation.x = clamp(camera_arm.rotation.x, deg_to_rad(-80.0), deg_to_rad(80.0))

func _physics_process(delta: float) -> void:
	if inventory_open:
		# Don't process movement when inventory is open
		velocity.x = 0
		velocity.z = 0
		move_and_slide()
		return
	
	# Handle cooldowns
	if shoot_cooldown > 0:
		shoot_cooldown -= delta
		if shoot_cooldown <= 0:
			can_shoot = true
	
	# Update speed based on state
	current_speed = move_speed
	if is_sprinting:
		current_speed *= sprint_multiplier
	if is_crouching:
		current_speed *= crouch_multiplier
	
	# Calculate movement direction relative to global space
	var global_move_dir = Vector3(move_direction.x, 0, move_direction.y)
	global_move_dir = global_move_dir.rotated(Vector3.UP, rotation.y)
	
	# Calculate target velocity
	target_velocity.x = global_move_dir.x * current_speed
	target_velocity.z = global_move_dir.z * current_speed
	
	# Apply gravity
	if not is_on_floor():
		velocity.y -= gravity * delta
	else:
		velocity.y = 0
	
	# Smooth movement
	velocity.x = lerp(velocity.x, target_velocity.x, delta * 10.0)
	velocity.z = lerp(velocity.z, target_velocity.z, delta * 10.0)
	
	# Move
	move_and_slide()
	
	# Update camera position for aiming
	if is_aiming:
		camera_node.position.z = camera_distance * 0.5
		camera_node.fov = 45.0
	else:
		camera_node.position.z = camera_distance
		camera_node.fov = 60.0
	
	# Handle camera collision
	_handle_camera_collision()
	
	# Update animations
	_update_animations()

func _handle_camera_collision() -> void:
	var camera_pos = camera_arm.global_position + camera_pivot.global_transform.basis.z * camera_node.position.z
	var camera_target_pos = camera_arm.global_position
	
	# Raycast from camera arm to camera position
	var space_state = get_world_3d().direct_space_state
	var query = PhysicsRayQueryParameters3D.new()
	query.from = camera_arm.global_position
	query.to = camera_pos
	query.collide_with_areas = false
	query.collide_with_bodies = true
	query.exclude = [self]
	
	var result = space_state.intersect_ray(query)
	
	if result:
		# Camera is hitting something, move it closer
		var hit_pos = result.position
		camera_pivot.position.z = -camera_arm.global_position.distance_to(hit_pos) + camera_collision_margin
	else:
		camera_pivot.position.z = 0

func _update_animations() -> void:
	if not animation_player:
		return
	
	# Determine animation state
	var speed = velocity.length()
	var is_moving = speed > 0.1
	
	# Reset all animation weights
	animation_player.active = true
	
	if is_moving:
		if is_sprinting:
			animation_player.play("sprint")
		elif is_crouching:
			animation_player.play("crouch_walk")
		else:
			animation_player.play("run")
	else:
		if is_crouching:
			animation_player.play("crouch_idle")
		else:
			animation_player.play("idle")
	
	# Check for jump/fall
	if not is_on_floor():
		if velocity.y > 0:
			animation_player.play("jump")
		else:
			animation_player.play("fall")

func shoot() -> void:
	if not current_weapon or not can_shoot or is_reloading:
		return
	
	# Check if we have ammo
	if current_weapon.current_ammo <= 0:
		# Try to reload automatically
		reload()
		return
	
	can_shoot = false
	shoot_cooldown = current_weapon.fire_rate
	
	# Use current slug's ability
	if current_slug:
		current_slug.activate(self, current_weapon)
	else:
		# Default weapon fire
		current_weapon.fire(self)
	
	# Play shoot animation
	if animation_player:
		animation_player.play("shoot")
	
	# Decrement ammo
	current_weapon.current_ammo -= 1
	ammo_changed.emit(current_weapon.current_ammo)

func reload() -> void:
	if not current_weapon or is_reloading:
		return
	
	is_reloading = true
	
	# Play reload animation
	if animation_player:
		animation_player.play("reload")
	
	# Reload after animation
	if animation_player:
		await animation_player.animation_finished
	
	current_weapon.reload()
	is_reloading = false
	ammo_changed.emit(current_weapon.current_ammo)

func switch_weapon() -> void:
	if weapons.size() <= 1:
		return
	
	current_weapon_index = (current_weapon_index + 1) % weapons.size()
	current_weapon = weapons[current_weapon_index]
	weapon_changed.emit(current_weapon)

func take_damage(amount: float) -> void:
	# Apply armor first
	if armor > 0:
		var armor_damage = min(amount, armor)
		armor -= armor_damage
		amount -= armor_damage
		armor_changed.emit(armor)
		
		if armor <= 0:
			armor = 0
	
	# Apply remaining damage to health
	if amount > 0:
		health -= amount
		health_changed.emit(health)
		
		if health <= 0:
			health = 0
			die()

func heal(amount: float) -> void:
	health = min(max_health, health + amount)
	health_changed.emit(health)

func add_armor(amount: float) -> void:
	armor = min(max_armor, armor + amount)
	armor_changed.emit(armor)

func die() -> void:
	# Play death animation
	if animation_player:
		animation_player.play("death")
	
	# Emit death signal
	died.emit()
	
	# Disable input
	Input.set_mouse_mode(Input.MOUSE_MODE_VISIBLE)

func respawn() -> void:
	health = max_health
	armor = 0
	
	# Reset position
	global_position = Vector3.ZERO
	velocity = Vector3.ZERO
	
	# Enable input
	Input.set_mouse_mode(Input.MOUSE_MODE_CAPTURED)
	
	# Emit respawn signal
	respawned.emit()

func interact() -> void:
	# Check for interactable objects
	var space_state = get_world_3d().direct_space_state
	var query = PhysicsRayQueryParameters3D.new()
	query.from = camera_node.global_position
	query.to = camera_node.global_position + camera_node.global_transform.basis.z * -5.0
	query.collide_with_areas = true
	query.collide_with_bodies = false
	query.exclude = [self]
	
	var result = space_state.intersect_ray(query)
	
	if result:
		var collider = result.collider
		if collider.is_in_group("loot"):
			pickup_loot(collider)
		elif collider.is_in_group("interactable"):
			collider.call_deferred("interact", self)

func pickup_loot(loot: Node3D) -> void:
	if loot.has_method("pickup"):
		loot.pickup(self)

func toggle_inventory() -> void:
	if inventory_open:
		close_inventory()
	else:
		open_inventory()

func open_inventory() -> void:
	inventory_open = true
	Input.set_mouse_mode(Input.MOUSE_MODE_VISIBLE)
	inventory_opened.emit()

func close_inventory() -> void:
	inventory_open = false
	Input.set_mouse_mode(Input.MOUSE_MODE_CAPTURED)
	inventory_closed.emit()

func add_weapon(weapon: Weapon) -> void:
	weapons.append(weapon)
	if weapons.size() == 1:
		current_weapon = weapon
		current_weapon_index = 0
		weapon_changed.emit(current_weapon)

func remove_weapon(index: int) -> void:
	if index < 0 or index >= weapons.size():
		return
	
	weapons.remove_at(index)
	
	if current_weapon_index >= index:
		current_weapon_index = max(0, current_weapon_index - 1)
	
	if weapons.size() > 0:
		current_weapon = weapons[current_weapon_index]
		weapon_changed.emit(current_weapon)
	else:
		current_weapon = null
		weapon_changed.emit(null)

func add_slug(slug: SlugResource, quantity: int = 1) -> void:
	if not slug:
		return
	
	if slug not in slugs:
		slugs.append(slug)
		
	if slug not in slug_quantities:
		slug_quantities[slug] = 0
	
	slug_quantities[slug] += quantity
	
	# If this is the first slug, set as current
	if not current_slug:
		current_slug = slug
		slug_changed.emit(current_slug)

func use_slug(slug: SlugResource) -> bool:
	if not slug or slug not in slug_quantities or slug_quantities[slug] <= 0:
		return false
	
	slug_quantities[slug] -= 1
	
	# If we used up all of this slug type, switch to another
	if slug_quantities[slug] <= 0:
		slug_quantities.erase(slug)
		slugs.erase(slug)
		
		if slug == current_slug:
			if slugs.size() > 0:
				current_slug = slugs[0]
				slug_changed.emit(current_slug)
			else:
				current_slug = null
				slug_changed.emit(null)
	
	return true

func get_current_slug_quantity() -> int:
	if current_slug and current_slug in slug_quantities:
		return slug_quantities[current_slug]
	return 0
