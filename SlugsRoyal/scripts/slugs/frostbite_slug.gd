extends SlugResource
class_name FrostbiteSlug

## FrostbiteSlug - Ice-based slug with slowing and freezing effects

func _init():
	super()
	slug_name = "Frostbite"
	description = "Ice projectile that slows and temporarily freezes enemies"
	color = Color.CYAN
	damage = 12.0
	projectile_speed = 22.0
	cooldown = 1.5
	area_radius = 2.5
	duration = 3.0
	slug_type = 1  # Ice

func activate(firer: Node3D, weapon: Node3D) -> void:
	# Fire ice projectile
	fire_projectile(firer, weapon)

func apply_effect(target: Node3D, hit_position: Vector3) -> void:
	# Apply initial damage
	super.apply_effect(target, hit_position)
	
	# Apply slow/freeze effect
	if target.has_method("apply_slow"):
		target.apply_slow(0.5, duration)  # Slow to 50% speed
	
	if target.has_method("apply_freeze"):
		target.apply_freeze(duration * 0.3)  # Freeze for 30% of duration
	
	# Create ice area effect
	if area_radius > 0:
		_create_ice_area(hit_position)

func _create_ice_area(position: Vector3) -> void:
	# Create an ice area that slows enemies
	var ice_area = Area3D.new()
	ice_area.global_position = position
	ice_area.scale = Vector3(area_radius * 2, 0.5, area_radius * 2)
	
	# Add collision shape
	var collision = CollisionShape3D.new()
	collision.shape = BoxShape3D.new()
	collision.shape.size = Vector3(area_radius * 2, 0.5, area_radius * 2)
	ice_area.add_child(collision)
	
	# Add ice particle effect
	var particles = GPUParticles3D.new()
	particles.emitting = true
	particles.amount = 15
	particles.lifetime = duration
	particles.emission_shape = GPUParticles3D.EMISSION_SHAPE_BOX
	particles.emission_half_extents = Vector3(area_radius, 0.2, area_radius)
	
	# Ice particle properties
	particles.direction = Vector3.UP
	particles.spread = 180.0
	particles.gravity = Vector3(0, -0.2, 0)
	particles.initial_velocity = 1.0
	
	# Visual properties
	particles.color_ramp = Gradient.new()
	particles.color_ramp.add_point(0.0, Color.CYAN)
	particles.color_ramp.add_point(0.5, Color.LIGHT_CYAN)
	particles.color_ramp.add_point(1.0, Color.WHITE)
	
	particles.scale_ramp = Gradient.new()
	particles.scale_ramp.add_point(0.0, 0.1)
	particles.scale_ramp.add_point(1.0, 0.3)
	
	ice_area.add_child(particles)
	
	# Add to scene
	var root = get_tree().root
	root.add_child(ice_area)
	
	# Setup slow effect for area
	var timer = Timer.new()
	ice_area.add_child(timer)
	timer.timeout.connect(_on_ice_area_timer.bind(ice_area))
	timer.start(0.5)
	
	# Remove ice area after duration
	var cleanup_timer = Timer.new()
	ice_area.add_child(cleanup_timer)
	cleanup_timer.timeout.connect(ice_area.queue_free)
	cleanup_timer.start(duration)

func _on_ice_area_timer(ice_area: Area3D) -> void:
	# Slow all enemies in the ice area
	var bodies = ice_area.get_overlapping_bodies()
	for body in bodies:
		if body.is_in_group("enemies") and body.has_method("apply_slow"):
			body.apply_slow(0.6, 0.5)  # Slow to 60% speed for 0.5 seconds
		elif body.is_in_group("players") and body != ice_area.get_parent():
			body.apply_slow(0.6, 0.5)
