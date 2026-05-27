from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import requests

app = FastAPI()

# Configuración crítica: Permitir que cualquier origen (tu GitHub Pages) consulte esta API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Cuando estés en producción, puedes cambiar el "*" por "https://torrecillas1990.github.io"
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/aviones")
def obtener_aviones():
    # Coordenadas de la Península Ibérica
    url = 'https://opensky-network.org/api/states/all?lamin=35.0&lomin=-10.0&lamax=44.0&lomax=5.0'
    
    # Opcional (pero recomendado): Si te creas una cuenta gratuita en OpenSky, 
    # puedes poner tus credenciales aquí y pasarás de 400 a 4.000 peticiones diarias.
    # auth = ('tu_usuario', 'tu_contraseña')
    
    try:
        # Petición limpia desde servidor a servidor.
        # requests.get(url, auth=auth, timeout=10) <-- Usa esto si pones credenciales
        response = requests.get(url, timeout=10)
        
        if response.status_code == 429:
            raise HTTPException(status_code=429, detail="OpenSky nos ha limitado (Too Many Requests).")
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail="Error en el servidor de OpenSky.")
            
        return response.json()
        
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Error de conexión interna: {str(e)}")