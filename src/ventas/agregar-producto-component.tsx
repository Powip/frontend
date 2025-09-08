import React from 'react'
import ModalContainer from '../components/ui/modal-container'
import Header from '../components/ui/header'
import FormContainer from '../components/ui/form-container'
import FormGrid from '../components/ui/form-grid'
import Label from '../components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Button } from '../components/ui/button'
import { X } from 'lucide-react'

export const AgregarProducto = () => {
  return (
    <ModalContainer>
      <Header
        action={
          <Button variant="table" className="bg-red rounded-full">
            <X strokeWidth={4} />
          </Button>
        }
      >
        Agregar Producto
      </Header>
      <FormContainer>
        <FormGrid>
          <div>
            <Label>Producto*</Label>
            <Select>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Value">Value</SelectItem>
                <SelectItem value="Value">Value</SelectItem>
                <SelectItem value="Value">Value</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </FormGrid>
        <FormGrid>
          <div>
            <Label>Talla*</Label>
            <Select>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Value">Value</SelectItem>
                <SelectItem value="Value">Value</SelectItem>
                <SelectItem value="Value">Value</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Color*</Label>
            <Select>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Value">Value</SelectItem>
                <SelectItem value="Value">Value</SelectItem>
                <SelectItem value="Value">Value</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </FormGrid>
      </FormContainer>
      <FormContainer>
        <FormGrid>
          <div>
            <Label>Cantidad*</Label>
            <Select>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Value">Value</SelectItem>
                <SelectItem value="Value">Value</SelectItem>
                <SelectItem value="Value">Value</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tipo de Descuento*</Label>
            <Select>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Value">Value</SelectItem>
                <SelectItem value="Value">Value</SelectItem>
                <SelectItem value="Value">Value</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Descuento</Label>
            <Select>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Value">Value</SelectItem>
                <SelectItem value="Value">Value</SelectItem>
                <SelectItem value="Value">Value</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </FormGrid>
      </FormContainer>
      <div className="grid grid-cols-4 gap-15 w-full">
              <Button variant="outline" className="col-span-1">
                Cancelar
              </Button>
              <Button variant='lime' className="col-span-3">Agrergar</Button>
            </div>
    </ModalContainer>
  )
}
