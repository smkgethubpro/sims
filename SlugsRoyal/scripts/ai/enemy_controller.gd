extends CharacterBody3D
class_name EnemyController
## EnemyController - AI enemy controller for Slugs Royal

# Signals
signal died
signal damaged(amount: float)

# Export variables
@export var move_speed: float = 4.0
@export var run_speed: float = 6.0
@export var jump_velocity: float = 4.5
@export var detection_range: float = 20.0
@export var attack_range: float = 10.0
@export var field_of_view: float = 90.0
@export var reaction_time: float = 0.5
@export var accuracy: float = 0.8

# Enemy stats
@export var max_health: float = 100.0
@export var damage: float = 10.0

# Current state
var health: float = max_health
var current_target: Node3D
var current_state: String = "idle"
var is_dead: bool = false
var can_attack: bool = true
var attack_cooldown: float = 0.0
var last_seen_player: Vector3
var time_since_seen: float = 0.0

# Navigation
@onready var navigation_agent: NavigationAgent3D = $NavigationAgent3D

# Combat
var current_weapon: Weapon
var weapons: Array[Weapon] = []
var current_slug: SlugResource

# References
@onready var animation_player: AnimationPlayer = $AnimationPlayer
@onready var hitbox: Area3D = $Hitbox
@onready var eyes: Node3D = $Eyes

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_PHYSICS
	
	# Initialize with default weapon
	if weapons.size() > 0:
		current_weapon = weapons[0]
	
	# Initialize with default slug
	if current_slug:
		current_slug = current_slug
	
	# Set initial state
	change_state("patrol")

func _physics_process(delta: float) -> void:
	if is_dead:
		return
	
	# Handle cooldowns
	if attack_cooldown > 0:
		attack_cooldown -= delta
		if attack_cooldown <= 0:
			can_attack = true
	
	# Update time since seen player
	if current_state == "chase" or current_state == "attack":
		time_since_seen += delta
		if time_since_seen > reaction_time * 2:
			# Lost track of player, go back to last seen position
			change_state("search")
	
	# State behavior
	match current_state:
		"idle":
			_idle_behavior(delta)
		"patrol":
			_patrol_behavior(delta)
		"chase":
			_chase_behavior(delta)
		"attack":
			_attack_behavior(delta)
		"search":
			_search_behavior(delta)
		"flee":
			_flee_behavior(delta)
		"cover":
			_cover_behavior(delta)
	
	# Update animations
	_update_animations()

func _idle_behavior(delta: float) -> void:
	# Look for player
	var player = _find_player()
	if player:
		last_seen_player = player.global_position
		time_since_seen = 0.0
		change_state("chase")
		return
	
	# Randomly decide to patrol
	if randf() < 0.01:  # 1% chance per frame to start patrolling
		change_state("patrol")

func _patrol_behavior(delta: float) -> void:
	# Look for player
	var player = _find_player()
	if player:
		last_seen_player = player.global_position
		time_since_seen = 0.0
		change_state("chase")
		return
	
	# Move to random patrol point
	if not navigation_agent.is_navigation_finished():
		var next_pos = navigation_agent.get_next_path_position()
		var direction = (next_pos - global_position).normalized()
		velocity.x = direction.x * move_speed
		velocity.z = direction.z * move_speed
	else:
		# Reached patrol point, find new one
		_find_random_patrol_point()
	
	move_and_slide()

func _chase_behavior(delta: float) -> void:
	# Look for player
	var player = _find_player()
	
	if player:
		last_seen_player = player.global_position
		time_since_seen = 0.0
		
		# Check if in attack range
		var distance_to_player = global_position.distance_to(player.global_position)
		if distance_to_player <= attack_range:
			change_state("attack")
			return
		
		# Move toward player
		if navigation_agent:
			navigation_agent.target_position = player.global_position
			var next_pos = navigation_agent.get_next_path_position()
			var direction = (next_pos - global_position).normalized()
			velocity.x = direction.x * run_speed
			velocity.z = direction.z * run_speed
		else:
			# Fallback to direct movement
			var direction = (player.global_position - global_position).normalized()
			velocity.x = direction.x * run_speed
			velocity.z = direction.z * run_speed
	else:
		# Move to last seen position
		if navigation_agent:
			navigation_agent.target_position = last_seen_player
			var next_pos = navigation_agent.get_next_path_position()
			var direction = (next_pos - global_position).normalized()
			velocity.x = direction.x * run_speed
			velocity.z = direction.z * run_speed
		else:
			var direction = (last_seen_player - global_position).normalized()
			velocity.x = direction.x * run_speed
			velocity.z = direction.z * run_speed
	
	move_and_slide()

func _attack_behavior(delta: float) -> void:
	# Look for player
	var player = _find_player()
	
	if player:
		last_seen_player = player.global_position
		time_since_seen = 0.0
		
		# Check if still in attack range
		var distance_to_player = global_position.distance_to(player.global_position)
		
		if distance_to_player > attack_range:
			change_state("chase")
			return
		
		# Face player
		look_at(player.global_position, Vector3.UP)
		
		# Attack if cooldown is ready
		if can_attack and current_weapon:
			_attack_player(player)
			can_attack = false
			attack_cooldown = current_weapon.fire_rate
		
		# Move slightly to avoid being a stationary target
		var strafe_dir = Vector3(randf_range(-1, 1), 0, randf_range(-1, 1)).normalized()
		velocity.x = strafe_dir.x * move_speed * 0.3
		velocity.z = strafe_dir.z * move_speed * 0.3
	else:
		change_state("search")
	
	move_and_slide()

func _search_behavior(delta: float) -> void:
	# Move to last seen position
	if global_position.distance_to(last_seen_player) > 1.0:
		if navigation_agent:
			navigation_agent.target_position = last_seen_player
			var next_pos = navigation_agent.get_next_path_position()
			var direction = (next_pos - global_position).normalized()
			velocity.x = direction.x * move_speed
			velocity.z = direction.z * move_speed
		else:
			var direction = (last_seen_player - global_position).normalized()
			velocity.x = direction.x * move_speed
			velocity.z = direction.z * move_speed
		move_and_slide()
	else:
		# Reached last seen position, look around
		rotation.y += delta * 30.0  # Rotate to look around
		
		# After looking around, go back to patrol
		if randf() < 0.005:  # Small chance to give up
			change_state("patrol")

func _flee_behavior(delta: float) -> void:
	# Run away from player
	if current_target:
		var direction = (global_position - current_target.global_position).normalized()
		velocity.x = direction.x * run_speed
		velocity.z = direction.z * run_speed
		move_and_slide()
	
	# After fleeing for a bit, go back to patrol
	if randf() < 0.01:
		change_state("patrol")

func _cover_behavior(delta: float) -> void:
	# Find cover and take position
	# This is a simplified version - in a full game you'd have a cover system
	if randf() < 0.01:
		change_state("patrol")

func _find_player() -> Node3D:
	# Find the nearest player
	var players = get_tree().get_nodes_in_group("players")
	var nearest_player = null
	var nearest_distance = detection_range + 1.0
	
	for player in players:
		if player == self:
			continue
		
		var distance = global_position.distance_to(player.global_position)
		if distance < nearest_distance:
			# Check field of view
			var direction_to_player = (player.global_position - global_position).normalized()
			var angle_to_player = rad_to_deg(rotation.y.angle_to(direction_to_player.angle()))
			
			if abs(angle_to_player) <= field_of_view * 0.5:
				# Check for line of sight
				if _has_line_of_sight(player):
					nearest_distance = distance
					nearest_player = player
		
		# Also check for line of sight to eyes position
		if nearest_player:
			var direction_to_eyes = (player.global_position + Vector3(0, 1.5, 0) - eyes.global_position).normalized()
			var angle_to_eyes = rad_to_deg(rotation.y.angle_to(direction_to_eyes.angle()))
			
			if abs(angle_to_eyes) > field_of_view * 0.5:
				# Player not in FOV, but might still be visible from body
				if _has_line_of_sight(nearest_player):
					return nearest_player
				else:
					return null
		
		return nearest_player
	
	return null

func _has_line_of_sight(target: Node3D) -> bool:
	var space_state = get_world_3d().direct_space_state
	var query = PhysicsRayQueryParameters3D.new()
	
	# Check from eyes to target
	query.from = eyes.global_position
	query.to = target.global_position + Vector3(0, 1.0, 0)  # Aim for chest/head
	query.collide_with_areas = false
	query.collide_with_bodies = true
	query.exclude = [self]
	
	var result = space_state.intersect_ray(query)
	
	# If we hit something, check if it's the target
	if result:
		var collider = result.collider
		return collider == target or collider.is_in_group("players")
	
	return true

func _find_random_patrol_point() -> void:
	# Find a random point within a certain radius
	var random_angle = randf() * TAU
	var random_distance = randf_range(5.0, 15.0)
	
	var patrol_point = global_position + Vector3(cos(random_angle), 0, sin(random_angle)) * random_distance
	
	if navigation_agent:
		navigation_agent.target_position = patrol_point

func _attack_player(player: Node3D) -> void:
	if not current_weapon:
		return
	
	# Face player
	look_at(player.global_position + Vector3(0, 1.0, 0), Vector3.UP)
	
	# Fire weapon with some inaccuracy
	var direction = (player.global_position - global_position).normalized()
	
	# Apply inaccuracy
	var spread = 1.0 - accuracy
	direction += Vector3(
		randf_range(-spread, spread),
		randf_range(-spread, spread),
		randf_range(-spread, spread)
	)
	direction = direction.normalized()
	
	# Fire weapon
	current_weapon.fire(self)

func change_state(new_state: String) -> void:
	current_state = new_state
	
	# Reset navigation when changing state
	if navigation_agent:
		navigation_agent.clear_path()

func take_damage(amount: float) -> void:
	if is_dead:
		return
	
	health -= amount
	damaged.emit(amount)
	
	if health <= 0:
		health = 0
		die()

func die() -> void:
	is_dead = true
	
	# Play death animation
	if animation_player:
		animation_player.play("death")
	
	# Disable physics
	process_mode = Node.PROCESS_MODE_DISABLED
	
	# Emit death signal
	died.emit()
	
	# Remove from scene after animation
	if animation_player:
		await animation_player.animation_finished
	
	queue_free()

func _update_animations() -> void:
	if not animation_player:
		return
	
	var speed = velocity.length()
	var is_moving = speed > 0.1
	
	if is_dead:
		return
	
	if is_moving:
		if current_state == "chase" or current_state == "flee":
			animation_player.play("run")
		else:
			animation_player.play("walk")
	else:
		if current_state == "attack":
			animation_player.play("shoot")
		else:
			animation_player.play("idle")

func add_weapon(weapon: Weapon) -> void:
	weapons.append(weapon)
	if weapons.size() == 1:
		current_weapon = weapon

func set_slug(slug: SlugResource) -> void:
	current_slug = slug

func get_health() -> float:
	return health

func get_max_health() -> float:
	return max_health
