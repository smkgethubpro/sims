extends Weapon
class_name Pistol
## Pistol - Standard pistol weapon

func _init():
	super()
	weapon_name = "Pistol"
	weapon_type = "Pistol"
	damage = 12.0
	fire_rate = 0.3
	max_ammo = 12
	reload_time = 1.5
	projectile_speed = 25.0
	spread = 0.05
