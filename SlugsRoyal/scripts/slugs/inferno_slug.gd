extends SlugResource
class_name InfernoSlug
## InfernoSlug - Fire-based slug with burning effects

func _init():
	super()
	slug_name = "Inferno"
	description = "Fire projectile that causes burning damage over time"
	color = Color.RED
	damage = 15.0
	projectile_speed = 25.0
	cooldown = 1.2
	area_radius = 3.0
	duration = 5.0
	slug_type = 0  # Fire

func activate(firer: Node3D, weapon: Node3D) -> void:
	# Fire projectile with burning effect
	fire_projectile(firer, weapon)

func apply_effect(target: Node3D, hit_position: Vector3) -> void:
	# Apply initial damage
	super.apply_effect(target, hit_position)
	
	# Apply burning effect
	if target.has_method("apply_burning"):
		target.apply_burning(damage * 0.5, duration)
	
	# Create fire area effect
	if area_radius > 0:
		_create_fire_area(hit_position)

func _create_fire_area(position: Vector3) -> void:
	# Create a fire area that damages enemies over time
	var fire_area = Area3D.new()
	fire_area.global_position = position
	fire_area.scale = Vector3(area_radius * 2, 1.0, area_radius * 2)
	
	# Add collision shape
	var collision = CollisionShape3D.new()
	collision.shape = BoxShape3D.new()
	collision.shape.size = Vector3(area_radius * 2, 1.0, area_radius * 2)
	fire_area.add_child(collision)
	
	# Add fire particle effect
	var particles = GPUParticles3D.new()
	particles.emitting = true
	particles.amount = 20
	particles.lifetime = duration
	particles.emission_shape = GPUParticles3D.EMISSION_SHAPE_BOX
	particles.emission_half_extents = Vector3(area_radius, 0.5, area_radius)
	
	# Fire particle properties
	particles.direction = Vector3.UP
	particles.spread = 180.0
	particles.gravity = Vector3(0, -0.5, 0)
	particles.initial_velocity = 2.0
	particles.initial_velocity_random = 1.0
	
	# Visual properties
	particles.color_ramp = Gradient.new()
	particles.color_ramp.add_point(0.0, Color.RED)
	particles.color_ramp.add_point(0.5, Color.ORANGE)
	particles.color_ramp.add_point(1.0, Color.YELLOW)
	
	particles.scale_ramp = Gradient.new()
	particles.scale_ramp.add_point(0.0, 0.2)
	particles.scale_ramp.add_point(1.0, 0.5)
	
	fire_area.add_child(particles)
	
	# Add to scene
	var root = get_tree().root
	root.add_child(fire_area)
	
	# Setup fire damage timer
	var timer = Timer.new()
	fire_area.add_child(timer)
	timer.timeout.connect(_on_fire_damage_timer.bind(fire_area, position))
	timer.start(0.5)
	
	# Remove fire area after duration
	var cleanup_timer = Timer.new()
	fire_area.add_child(cleanup_timer)
	cleanup_timer.timeout.connect(fire_area.queue_free)
	cleanup_timer.start(duration)

func _on_fire_damage_timer(fire_area: Area3D, position: Vector3) -> void:
	# Damage all enemies in the fire area
	var bodies = fire_area.get_overlapping_bodies()
	for body in bodies:
		if body.is_in_group("enemies") and body.has_method("take_damage"):
			body.take_damage(damage * 0.1)  # Continuous fire damage
		elif body.is_in_group("players") and body != fire_area.get_parent():
			body.take_damage(damage * 0.1)
