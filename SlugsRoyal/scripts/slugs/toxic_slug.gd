extends SlugResource
class_name ToxicSlug

## ToxicSlug - Poison-based slug with damage over time

func _init():
	super()
	slug_name = "Toxic"
	description = "Poison projectile that creates toxic clouds"
	color = Color.GREEN
	damage = 8.0
	projectile_speed = 18.0
	cooldown = 1.0
	area_radius = 4.0
	duration = 8.0
	slug_type = 3  # Toxic

# Poison properties
@export var poison_damage_per_second: float = 5.0
@export var cloud_lifetime: float = duration

func activate(firer: Node3D, weapon: Node3D) -> void:
	# Fire toxic projectile
	fire_projectile(firer, weapon)

func apply_effect(target: Node3D, hit_position: Vector3) -> void:
	# Apply initial damage
	super.apply_effect(target, hit_position)
	
	# Apply poison effect
	if target.has_method("apply_poison"):
		target.apply_poison(poison_damage_per_second, duration)
	
	# Create toxic cloud
	_create_toxic_cloud(hit_position)

func _create_toxic_cloud(position: Vector3) -> void:
	# Create a toxic cloud area
	var cloud_area = Area3D.new()
	cloud_area.global_position = position
	cloud_area.scale = Vector3(area_radius * 2, 2.0, area_radius * 2)
	
	# Add collision shape
	var collision = CollisionShape3D.new()
	collision.shape = SphereShape3D.new()
	collision.shape.radius = area_radius
	cloud_area.add_child(collision)
	
	# Add toxic particle effect
	var particles = GPUParticles3D.new()
	particles.emitting = true
	particles.amount = 30
	particles.lifetime = cloud_lifetime
	particles.emission_shape = GPUParticles3D.EMISSION_SHAPE_SPHERE
	particles.emission_sphere_radius = area_radius
	
	# Toxic particle properties
	particles.direction = Vector3.UP
	particles.spread = 180.0
	particles.gravity = Vector3(0, -0.1, 0)
	particles.initial_velocity = 0.5
	
	# Visual properties
	particles.color_ramp = Gradient.new()
	particles.color_ramp.add_point(0.0, Color.DARK_GREEN)
	particles.color_ramp.add_point(0.5, Color.GREEN)
	particles.color_ramp.add_point(1.0, Color.LIGHT_GREEN)
	
	particles.scale_ramp = Gradient.new()
	particles.scale_ramp.add_point(0.0, 0.3)
	particles.scale_ramp.add_point(1.0, 0.8)
	
	particles.transparency_flags = GPUParticles3D.FLAG_TRANSPARENT
	
	cloud_area.add_child(particles)
	
	# Add to scene
	var root = get_tree().root
	root.add_child(cloud_area)
	
	# Setup damage timer
	var timer = Timer.new()
	cloud_area.add_child(timer)
	timer.timeout.connect(_on_toxic_damage_timer.bind(cloud_area, position))
	timer.start(0.5)
	
	# Remove cloud after duration
	var cleanup_timer = Timer.new()
	cloud_area.add_child(cleanup_timer)
	cleanup_timer.timeout.connect(cloud_area.queue_free)
	cleanup_timer.start(cloud_lifetime)

func _on_toxic_damage_timer(cloud_area: Area3D, position: Vector3) -> void:
	# Damage all enemies in the toxic cloud
	var bodies = cloud_area.get_overlapping_bodies()
	for body in bodies:
		if body.is_in_group("enemies") and body.has_method("take_damage"):
			body.take_damage(poison_damage_per_second * 0.5)
		elif body.is_in_group("players") and body != cloud_area.get_parent():
			body.take_damage(poison_damage_per_second * 0.5)
