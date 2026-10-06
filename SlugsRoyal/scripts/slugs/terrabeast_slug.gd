extends SlugResource
class_name TerrabeastSlug

## TerrabeastSlug - Earth-based slug with ground shockwave

func _init():
	super()
	slug_name = "Terrabeast"
	description = "Heavy impact slug that creates ground shockwaves"
	color = Color.BROWN
	damage = 25.0
	projectile_speed = 15.0
	cooldown = 2.0
	area_radius = 6.0
	duration = 1.0
	slug_type = 4  # Earth

# Shockwave properties
@export var shockwave_speed: float = 10.0
@export var max_shockwave_radius: float = area_radius

func activate(firer: Node3D, weapon: Node3D) -> void:
	# Fire heavy projectile
	fire_projectile(firer, weapon)

func apply_effect(target: Node3D, hit_position: Vector3) -> void:
	# Apply heavy damage
	super.apply_effect(target, hit_position)
	
	# Create shockwave
	_create_shockwave(hit_position)

func _create_shockwave(position: Vector3) -> void:
	# Create a shockwave that expands outward
	var shockwave = Node3D.new()
	shockwave.global_position = position
	
	# Add to scene
	var root = get_tree().root
	root.add_child(shockwave)
	
	# Create expanding ring
	var ring = MeshInstance3D.new()
	var ring_mesh = ArrayMesh.new()
	var surface_tool = SurfaceTool.new()
	
	surface_tool.create_from(shockwave, 0.1)
	surface_tool.begin(Mesh.PRIMITIVE_TRIANGLES)
	
	# This is a simplified ring - in practice use a proper ring mesh
	var material = StandardMaterial3D.new()
	material.albedo_color = Color.BROWN * 1.5
	material.emission_color = Color.ORANGE
	material.emission_enabled = true
	material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	material.albedo_alpha = 0.5
	
	# Create a simple ring using a torus
	var torus = TorusMesh.new()
	torus.outer_radius = 0.1
	torus.inner_radius = 0.05
	torus.outer_segments = 32
	torus.inner_segments = 8
	
	ring.mesh = torus
	ring.material_override = material
	shockwave.add_child(ring)
	
	# Animate the shockwave
	var scale_timer = Timer.new()
	shockwave.add_child(scale_timer)
	
	var current_radius = 0.0
	var target_radius = max_shockwave_radius
	
	func _on_scale_timer():
		current_radius += shockwave_speed * 0.1
		if current_radius >= target_radius:
			current_radius = target_radius
			scale_timer.stop()
			
			# Remove shockwave after duration
			var cleanup_timer = Timer.new()
			shockwave.add_child(cleanup_timer)
			cleanup_timer.timeout.connect(shockwave.queue_free)
			cleanup_timer.start(0.5)
			return
		
		ring.scale = Vector3(current_radius * 2, 1.0, current_radius * 2)
		
		# Damage enemies in the shockwave path
		var space_state = shockwave.get_world_3d().direct_space_state
		var sphere_query = PhysicsSphereQueryParameters3D.new()
		sphere_query.position = position
		sphere_query.radius = current_radius
		sphere_query.collide_with_areas = false
		sphere_query.collide_with_bodies = true
		
		var result = space_state.intersect_sphere(sphere_query)
		for rid in result:
			var body = space_state.get_rid_data(rid)
			if body and (body.is_in_group("enemies") or body.is_in_group("players")):
				if body.has_method("take_damage") and body != shockwave.get_parent():
					body.take_damage(damage * 0.3)  # Shockwave damage
		
	scale_timer.timeout.connect(_on_scale_timer)
	scale_timer.start(0.1)
