extends Projectile
class_name SlugProjectile
## SlugProjectile - Projectile with slug-specific effects

# Slug type reference
var slug: SlugResource

# Override hit behavior for slug effects
func _on_body_entered(body: Node3D) -> void:
	# Ignore owner
	if body == owner:
		return
	
	# Apply slug effect
	if slug:
		slug.apply_effect(body, global_position)
	else:
		# Fallback to default damage
		if body.has_method("take_damage"):
			body.take_damage(damage)
	
	# Emit hit signal
	hit.emit(body, global_position)
	
	# Create impact effect
	_on_hit(body, global_position)
	
	# Destroy projectile
	queue_free()

func _on_hit(target: Node3D, position: Vector3) -> void:
	# Create slug-specific impact effect
	if slug and slug.impact_effect:
		var effect = slug.impact_effect.instantiate()
		effect.global_position = position
		owner.get_parent().add_child(effect)
		effect.call_deferred("play")

func set_slug(slug_resource: SlugResource) -> void:
	slug = slug_resource
	
	# Override projectile properties with slug properties
	if slug:
		damage = slug.damage
		speed = slug.projectile_speed
		lifetime = 10.0  # Longer lifetime for slug projectiles

func get_slug() -> SlugResource:
	return slug
