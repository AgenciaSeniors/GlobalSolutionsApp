"use client"

import * as React from "react"
import Link from "next/link"
import Button from "@/components/ui/Button"
import Input from "@/components/ui/Input"

export default function RegisterForm() {
  const [isLoading, setIsLoading] = React.useState<boolean>(false)

  async function onSubmit(event: React.SyntheticEvent) {
    event.preventDefault()
    setIsLoading(true)

    // Simulación de registro
    setTimeout(() => {
      setIsLoading(false)
    }, 2000)
  }

  return (
    <div className="grid gap-6">
      <form onSubmit={onSubmit}>
        <div className="grid gap-4">
          
          <div className="grid gap-1">
            <label className="text-sm font-medium leading-none" htmlFor="name">
              Nombre Completo
            </label>
            <Input
              id="name"
              placeholder="Ej: Juan Pérez"
              type="text"
              autoCapitalize="words"
              autoComplete="name"
              autoCorrect="off"
              disabled={isLoading}
              required
            />
          </div>

          <div className="grid gap-1">
            <label className="text-sm font-medium leading-none" htmlFor="email">
              Correo electrónico
            </label>
            <Input
              id="email"
              placeholder="nombre@ejemplo.com"
              type="email"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect="off"
              disabled={isLoading}
              required
            />
          </div>

          <div className="grid gap-1">
            <label className="text-sm font-medium leading-none" htmlFor="password">
              Contraseña
            </label>
            <Input
              id="password"
              placeholder="••••••••"
              type="password"
              autoComplete="new-password"
              disabled={isLoading}
              required
            />
          </div>

          {/* Este sí es el botón principal del formulario */}
          <Button disabled={isLoading} className="mt-2 w-full">
            {isLoading ? "Creando cuenta..." : "Crear cuenta"}
          </Button>

        </div>
      </form>
      
      {/* AQUÍ ESTÁ EL CAMBIO: Texto normal con enlace azul, SIN botón */}
      <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-2">
        ¿Ya tienes cuenta?{" "}
        <Link 
          href="/login" 
          className="text-blue-600 font-medium hover:text-blue-800 hover:underline transition-colors"
        >
          Iniciar sesión
        </Link>
      </p>
      
    </div>
  )
}