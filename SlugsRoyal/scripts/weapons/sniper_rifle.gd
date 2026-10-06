extends Weapon
class_name SniperRifle

## SniperRifle - Long-range high-damage weapon

func _init():
	super()
	weapon_name = "Sniper Rifle"
	weapon_type = "Sniper"
	damage = 50.0
	fire_rate = 1.5
	max_ammo = 5
	reload_time = 3.0
	projectile_speed = 40.0
	spread = 0.001
