import RegisterForm from "@/components/forms/RegisterForm"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Crear cuenta | Global Solutions Travel",
  description: "Crea tu cuenta en Global Solutions Travel",
}

export default function RegisterPage() {
  return (
    <>
      {/* Añadimos mb-8 para separar el encabezado del formulario */}
      <div className="flex flex-col space-y-2 text-center mb-8">
        {/* Usamos font-bold y text-gray-900 para que el título resalte más */}
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          Crear cuenta
        </h1>
        <p className="text-sm text-muted-foreground">
          Ingresa tus datos para registrarte en la plataforma
        </p>
      </div>
      
      <RegisterForm />
    </>
  )
}